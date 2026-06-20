import json

from unittest.mock import patch

from django.contrib.auth.hashers import check_password, make_password
from django.test import TestCase
from django.utils import timezone

from service.models import AccessGroup, Demand, PasswordReset, ServiceRequest, SessionToken, User


class UserRegistrationTests(TestCase):
    def setUp(self):
        self.admin_group = AccessGroup.objects.create(id=1, nome="Administradores")
        self.docente_group = AccessGroup.objects.create(id=2, nome="Docentes")
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
        response = self.post_json("/api/auth/forgot-password", {"login": "ADMIN"})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(PasswordReset.objects.filter(user=self.admin).exists())
        self.assertEqual(write_email.call_args.args[0], "admin@ufam.edu.br")

        external_response = self.post_json(
            "/api/auth/forgot-password",
            {"email": "admin@example.com"},
        )
        self.assertEqual(external_response.status_code, 422)

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
                    "bloco": "Bloco A",
                    "sala": "Sala 1",
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
                "bloco": "Bloco B",
                "sala": "Sala 2",
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
