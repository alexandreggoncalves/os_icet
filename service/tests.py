import json
import datetime

from unittest.mock import patch

from django.contrib.auth.hashers import check_password, make_password
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from service.models import AccessGroup, Block, Demand, Interaction, Location, PasswordReset, ServiceRequest, SessionToken, User
from service.views import format_dt


class UserRegistrationTests(TestCase):
    def setUp(self):
        self.admin_group = AccessGroup.objects.create(id=1, nome="Administradores")
        self.docente_group = AccessGroup.objects.create(id=2, nome="Docentes")
        self.location, _ = Location.objects.get_or_create(nome="ICET")
        self.block_a, _ = Block.objects.get_or_create(location=self.location, nome="Bloco A")
        self.block_b, _ = Block.objects.get_or_create(location=self.location, nome="Bloco B")
        self.admin = User.objects.create(
            nome="Administrador",
            login="admin",
            email="admin@ufam.edu.br",
            siape="1000001",
            password_hash=make_password("Admin@123"),
            group=self.admin_group,
            role="admin",
        )
        SessionToken.objects.create(
            token="admin-test-token",
            user=self.admin,
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )

    def post_json(self, path, payload, authenticated=False):
        headers = {"HTTP_AUTHORIZATION": "Bearer admin-test-token"} if authenticated else {}
        return self.client.post(path, data=json.dumps(payload), content_type="application/json", **headers)

    def put_json(self, path, payload):
        return self.client.put(
            path,
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer admin-test-token",
        )

    def make_request(self, **kwargs):
        payload = {
            "protocolo": f"OS-TESTE-{ServiceRequest.objects.count() + 1:03d}",
            "owner_user": self.admin,
            "nome": "Solicitante",
            "siape": "1234567",
            "email": "solicitante@ufam.edu.br",
            "perfil": "Docente",
            "local": "ICET",
            "bloco": "Bloco A",
            "sala": "101",
            "categoria": "Suporte Audiovisual",
            "descricao": "Chamado de teste.",
            "status": "Aberto",
        }
        payload.update(kwargs)
        return ServiceRequest.objects.create(**payload)

    def test_first_access_derives_email_from_login(self):
        response = self.post_json(
            "/api/auth/register",
            {
                "nome": "Pessoa Teste",
                "login": "Pessoa.Teste",
                "siape": "1234567",
                "cargo": "Docente",
            },
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(siape="1234567")
        self.assertEqual(user.login, "pessoa.teste")
        self.assertEqual(user.email, "pessoa.teste@ufam.edu.br")

    def test_format_dt_uses_manaus_offset(self):
        value = datetime.datetime(2026, 6, 22, 13, 30, tzinfo=datetime.UTC)

        self.assertEqual(format_dt(value), "2026-06-22T09:30:00-04:00")

    @patch("service.views.write_approval_email")
    def test_admin_creation_generates_temporary_password_and_email(self, write_email):
        response = self.post_json(
            "/api/users",
            {
                "nome": "Pessoa Teste",
                "login": "Pessoa.Teste",
                "siape": "7654321",
                "grupo_id": self.docente_group.id,
            },
            authenticated=True,
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(login="pessoa.teste")
        self.assertEqual(user.email, "pessoa.teste@ufam.edu.br")
        self.assertEqual(user.siape, "7654321")
        self.assertTrue(user.active)
        self.assertEqual(user.approval_status, "approved")
        self.assertTrue(user.first_login_required)
        write_email.assert_called_once()
        emailed_user, temporary_password = write_email.call_args.args
        self.assertEqual(emailed_user, user)
        self.assertTrue(check_password(temporary_password, user.password_hash))

        SessionToken.objects.create(
            token="new-user-token",
            user=user,
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )
        first_access_response = self.client.post(
            "/api/auth/complete-first-access",
            data=json.dumps(
                {
                    "temporary_password": temporary_password,
                    "new_password": "Definitiva@123",
                    "confirm_password": "Definitiva@123",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer new-user-token",
        )

        self.assertEqual(first_access_response.status_code, 200)
        user.refresh_from_db()
        self.assertFalse(user.first_login_required)
        self.assertTrue(check_password("Definitiva@123", user.password_hash))

    @patch("service.views.write_approval_email")
    def test_admin_creation_accepts_email_prefix_field(self, write_email):
        response = self.post_json(
            "/api/users",
            {
                "nome": "Email Prefixo",
                "email": "Email.Prefixo",
                "siape": "7654322",
                "grupo_id": self.docente_group.id,
            },
            authenticated=True,
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(login="email.prefixo")
        self.assertEqual(user.email, "email.prefixo@ufam.edu.br")
        self.assertEqual(user.siape, "7654322")
        write_email.assert_called_once()

    @patch("service.views.write_rejection_email")
    def test_admin_can_reject_pending_registration(self, write_email):
        pending = User.objects.create(
            nome="Cadastro Pendente",
            login="cadastro.pendente",
            email="cadastro.pendente@ufam.edu.br",
            siape="7654323",
            cargo="Docente",
            password_hash=make_password("Temporaria@123"),
            group=self.docente_group,
            active=False,
            approval_status="pending",
            first_login_required=True,
        )

        response = self.post_json(f"/api/users/{pending.id}/reject", {}, authenticated=True)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(id=pending.id).exists())
        write_email.assert_called_once()
        self.assertEqual(write_email.call_args.args[0].email, "cadastro.pendente@ufam.edu.br")

    @patch("service.views.write_rejection_email")
    def test_admin_cannot_reject_approved_user(self, write_email):
        response = self.post_json(f"/api/users/{self.admin.id}/reject", {}, authenticated=True)

        self.assertEqual(response.status_code, 422)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())
        write_email.assert_not_called()

    def test_siape_requires_exactly_seven_digits(self):
        scenarios = [
            (
                "/api/auth/register",
                {"nome": "Pessoa Teste", "login": "pessoa.teste", "siape": "123456", "cargo": "Docente"},
                False,
            ),
            (
                "/api/users",
                {
                    "nome": "Pessoa Teste",
                    "login": "pessoa.teste",
                    "siape": "12345678",
                    "grupo_id": self.docente_group.id,
                },
                True,
            ),
        ]

        for path, payload, authenticated in scenarios:
            with self.subTest(path=path):
                response = self.post_json(path, payload, authenticated=authenticated)
                self.assertEqual(response.status_code, 422)
                self.assertIn("exatamente 7 dígitos", response.json()["detail"])

    @patch("service.views.write_reset_email")
    def test_password_reset_uses_institutional_login(self, write_email):
        self.admin.email = "admin@icet.ufam.edu.br"
        self.admin.save(update_fields=["email"])
        response = self.post_json("/api/auth/forgot-password", {"login": "ADMIN"})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(PasswordReset.objects.filter(user=self.admin).exists())
        self.assertEqual(write_email.call_args.args[0], "admin@ufam.edu.br")

        external_response = self.post_json(
            "/api/auth/forgot-password",
            {"email": "admin@example.com"},
        )
        self.assertEqual(external_response.status_code, 422)

    def test_three_invalid_passwords_lock_account_for_fifteen_minutes(self):
        for attempt in range(1, 4):
            response = self.post_json(
                "/api/auth/login",
                {"login": "admin", "password": "SenhaIncorreta@1"},
            )
            self.assertEqual(response.status_code, 423 if attempt == 3 else 401)

        self.admin.refresh_from_db()
        self.assertEqual(self.admin.failed_login_attempts, 3)
        self.assertGreater(self.admin.locked_until, timezone.now() + timezone.timedelta(minutes=14))

        blocked_response = self.post_json(
            "/api/auth/login",
            {"login": "admin", "password": "Admin@123"},
        )
        self.assertEqual(blocked_response.status_code, 423)

    def test_expired_lock_allows_login_and_clears_attempts(self):
        self.admin.failed_login_attempts = 3
        self.admin.locked_until = timezone.now() - timezone.timedelta(seconds=1)
        self.admin.save(update_fields=["failed_login_attempts", "locked_until"])

        response = self.post_json(
            "/api/auth/login",
            {"login": "admin", "password": "Admin@123"},
        )

        self.assertEqual(response.status_code, 200)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.failed_login_attempts, 0)
        self.assertIsNone(self.admin.locked_until)

    def test_password_reset_unlocks_account(self):
        code = "123456"
        self.admin.email = "admin@icet.ufam.edu.br"
        self.admin.failed_login_attempts = 3
        self.admin.locked_until = timezone.now() + timezone.timedelta(minutes=15)
        self.admin.save(update_fields=["email", "failed_login_attempts", "locked_until"])
        PasswordReset.objects.create(
            user=self.admin,
            code_hash=make_password(code),
            expires_at=timezone.now() + timezone.timedelta(minutes=15),
        )

        response = self.post_json(
            "/api/auth/reset-password",
            {
                "email": "admin@ufam.edu.br",
                "code": code,
                "new_password": "NovaSenha@123",
                "confirm_password": "NovaSenha@123",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.failed_login_attempts, 0)
        self.assertIsNone(self.admin.locked_until)
        self.assertTrue(check_password("NovaSenha@123", self.admin.password_hash))

        login_response = self.post_json(
            "/api/auth/login",
            {"login": "admin", "password": "NovaSenha@123"},
        )
        self.assertEqual(login_response.status_code, 200)

    def test_request_uses_authenticated_users_registered_siape(self):
        requester = User.objects.create(
            nome="Solicitante Teste",
            login="solicitante.teste",
            email="solicitante.teste@ufam.edu.br",
            siape="2468135",
            password_hash=make_password("Solicitante@123"),
            group=self.docente_group,
            role="user",
        )
        SessionToken.objects.create(
            token="requester-token",
            user=requester,
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )

        response = self.client.post(
            "/api/requests",
            data=json.dumps(
                {
                    "siape": "9999999",
                    "local": "ICET",
                    "bloco": "Bloco A",
                    "sala": "101",
                    "categoria": "Suporte Audiovisual",
                    "descricao": "Teste de SIAPE cadastrado.",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer requester-token",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ServiceRequest.objects.get().siape, "2468135")

    def test_admin_request_uses_own_registered_data_and_ownership(self):
        response = self.post_json(
            "/api/requests",
            {
                "nome": "Outro solicitante",
                "siape": "9999999",
                "email": "outro@ufam.edu.br",
                "perfil": "Outro grupo",
                "local": "ICET",
                "bloco": "Bloco B",
                "sala": "102",
                "categoria": "Suporte Audiovisual",
                "descricao": "Chamado aberto pelo administrador.",
            },
            authenticated=True,
        )

        self.assertEqual(response.status_code, 201)
        item = ServiceRequest.objects.get()
        self.assertEqual(item.owner_user, self.admin)
        self.assertEqual(item.nome, self.admin.nome)
        self.assertEqual(item.siape, self.admin.siape)
        self.assertEqual(item.email, self.admin.email)
        self.assertEqual(item.perfil, "Administradores")
        self.assertEqual(item.local, "ICET")

    def test_request_requires_numeric_room_with_up_to_three_digits(self):
        response = self.post_json(
            "/api/requests",
            {
                "local": "ICET",
                "bloco": "Bloco B",
                "sala": "Sala 2",
                "categoria": "Suporte Audiovisual",
                "descricao": "Sala inválida.",
            },
            authenticated=True,
        )

        self.assertEqual(response.status_code, 422)

    def test_open_request_cannot_be_resolved_before_in_progress(self):
        item = self.make_request(status="Aberto")

        response = self.put_json(f"/api/requests/{item.id}/status", {"status": "Resolvido"})

        self.assertEqual(response.status_code, 422)
        item.refresh_from_db()
        self.assertEqual(item.status, "Aberto")

    def test_open_request_requires_admin_assignment_to_enter_progress(self):
        item = self.make_request(status="Aberto")

        response = self.put_json(f"/api/requests/{item.id}/status", {"status": "Em Atendimento"})

        self.assertEqual(response.status_code, 422)
        item.refresh_from_db()
        self.assertEqual(item.status, "Aberto")

    def test_open_request_enters_progress_with_assigned_admin_and_interaction(self):
        item = self.make_request(status="Aberto")

        response = self.put_json(
            f"/api/requests/{item.id}/status",
            {"status": "Em Atendimento", "assigned_user_id": self.admin.id},
        )

        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.status, "Em Atendimento")
        self.assertEqual(item.assigned_user, self.admin)
        interaction = Interaction.objects.get(request=item)
        self.assertEqual(interaction.tipo, "status")
        self.assertIn(self.admin.nome, interaction.mensagem)

    def test_in_progress_request_cannot_return_to_open(self):
        item = self.make_request(status="Em Atendimento", assigned_user=self.admin)

        response = self.put_json(f"/api/requests/{item.id}/status", {"status": "Aberto"})

        self.assertEqual(response.status_code, 422)
        item.refresh_from_db()
        self.assertEqual(item.status, "Em Atendimento")

    def test_seed_assigns_placeholder_siape_to_master_admin(self):
        call_command("seed_data", verbosity=0)

        self.admin.refresh_from_db()
        self.assertEqual(self.admin.siape, "0000000")

    def test_admin_can_update_users_siape(self):
        user = User.objects.create(
            nome="Usuário Editável",
            login="usuario.editavel",
            email="usuario.editavel@ufam.edu.br",
            siape="1111111",
            password_hash=make_password("Teste@123"),
            group=self.docente_group,
        )

        response = self.put_json(
            f"/api/users/{user.id}",
            {
                "nome": user.nome,
                "login": user.login,
                "siape": "2222222",
                "grupo_id": self.docente_group.id,
                "active": True,
            },
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.siape, "2222222")

    def test_admin_can_update_user_from_full_institutional_email(self):
        user = User.objects.create(
            nome="Usuário Editável",
            login="usuario.editavel",
            email="usuario.editavel@ufam.edu.br",
            siape="3333333",
            password_hash=make_password("Teste@123"),
            group=self.docente_group,
        )

        response = self.put_json(
            f"/api/users/{user.id}",
            {
                "nome": "Usuário Alterado",
                "email": "Novo.Usuario@ufam.edu.br",
                "siape": "4444444",
                "grupo_id": self.docente_group.id,
                "active": True,
            },
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.login, "novo.usuario")
        self.assertEqual(user.email, "novo.usuario@ufam.edu.br")
        self.assertEqual(user.siape, "4444444")

    def test_administrators_group_cannot_be_edited_or_deactivated(self):
        response = self.put_json(
            f"/api/groups/{self.admin_group.id}",
            {"nome": "Outro nome", "descricao": "Alterada", "active": False},
        )

        self.assertEqual(response.status_code, 403)
        self.admin_group.refresh_from_db()
        self.assertEqual(self.admin_group.nome, "Administradores")
        self.assertTrue(self.admin_group.active)

    def test_regular_group_can_be_edited_and_deactivated(self):
        response = self.put_json(
            f"/api/groups/{self.docente_group.id}",
            {"nome": "Professores", "descricao": "Grupo atualizado", "active": False},
        )

        self.assertEqual(response.status_code, 200)
        self.docente_group.refresh_from_db()
        self.assertEqual(self.docente_group.nome, "Professores")
        self.assertFalse(self.docente_group.active)

    def test_demand_can_be_edited_and_deactivated_without_deletion(self):
        demand = Demand.objects.create(nome="Demanda antiga", prazo="2 dias úteis")
        service_request = ServiceRequest.objects.create(
            protocolo="OS-TESTE-001",
            nome="Solicitante",
            siape="1234567",
            email="solicitante@ufam.edu.br",
            perfil="Docente",
            local="ICET",
            bloco="A",
            sala="1",
            categoria=demand.nome,
            descricao="Solicitação histórica",
        )

        response = self.put_json(
            f"/api/demands/{demand.id}",
            {"nome": "Demanda atualizada", "prazo": "5 dias úteis", "active": False},
        )

        self.assertEqual(response.status_code, 200)
        demand.refresh_from_db()
        service_request.refresh_from_db()
        self.assertEqual(demand.prazo, "5 dias úteis")
        self.assertFalse(demand.active)
        self.assertEqual(service_request.categoria, "Demanda atualizada")

        delete_response = self.client.delete(
            f"/api/demands/{demand.id}",
            HTTP_AUTHORIZATION="Bearer admin-test-token",
        )
        self.assertEqual(delete_response.status_code, 405)
        self.assertTrue(Demand.objects.filter(id=demand.id).exists())

    def test_location_and_block_management(self):
        location_response = self.post_json("/api/locations", {"nome": "Campus Teste"}, authenticated=True)
        self.assertEqual(location_response.status_code, 201)
        location = Location.objects.get(nome="Campus Teste")

        block_response = self.post_json(
            "/api/blocks",
            {"nome": "Bloco Novo", "local_id": location.id},
            authenticated=True,
        )
        self.assertEqual(block_response.status_code, 201)
        block = Block.objects.get(nome="Bloco Novo", location=location)

        service_request = ServiceRequest.objects.create(
            protocolo="OS-TESTE-002",
            nome="Solicitante",
            siape="7654321",
            email="solicitante@ufam.edu.br",
            perfil="Docente",
            local=location.nome,
            bloco=block.nome,
            sala="12",
            categoria="Suporte",
            descricao="Solicitação histórica",
        )

        update_location_response = self.put_json(f"/api/locations/{location.id}", {"nome": "Campus Atualizado", "active": True})
        self.assertEqual(update_location_response.status_code, 200)
        update_block_response = self.put_json(
            f"/api/blocks/{block.id}",
            {"nome": "Bloco Atualizado", "local_id": location.id, "active": True},
        )
        self.assertEqual(update_block_response.status_code, 200)
        service_request.refresh_from_db()
        self.assertEqual(service_request.local, "Campus Atualizado")
        self.assertEqual(service_request.bloco, "Bloco Atualizado")
