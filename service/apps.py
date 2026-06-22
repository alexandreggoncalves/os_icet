from django.apps import AppConfig


class ServiceConfig(AppConfig):
    """Configuração da aplicação Django que concentra regras do sistema de OS."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "service"
