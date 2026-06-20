import json

from unittest.mock import patch

from django.contrib.auth.hashers import check_password, make_password
from django.test import TestCase
from django.utils import timezone

from service.models import AccessGroup, PasswordReset, SessionToken, User


class UserRegistrationTests(TestCase):
    def setUp(self):
        self.admin_group = AccessGroup.objects.create(id=1, nome="Administradores")
        self.docente_group = AccessGroup.objects.create(id=2, nome="Docentes")
        self.admin = User.objects.create(
            nome="Administrador",
            login="admin",
            email="admin@ufam.edu.br",
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
