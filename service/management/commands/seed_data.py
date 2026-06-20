from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction

from service.models import AccessGroup, Demand, Interaction, ServiceRequest, User
from service.views import create_request_record


class Command(BaseCommand):
    help = "Cria os dados iniciais compatíveis com o protótipo original."

    def handle(self, *args, **options):
        with transaction.atomic():
            admin_group, _ = AccessGroup.objects.update_or_create(
                id=1,
                defaults={"nome": "Administradores", "descricao": "Acesso completo ao sistema local."},
            )
            docente_group, _ = AccessGroup.objects.update_or_create(
                id=2,
                defaults={"nome": "Docentes", "descricao": "Podem criar e consultar as próprias solicitações."},
            )
            tecnico_group, _ = AccessGroup.objects.update_or_create(
                id=3,
                defaults={"nome": "Técnicos Administrativos", "descricao": "Podem criar e consultar as próprias solicitações."},
            )

            User.objects.update_or_create(
                login="admin",
                defaults={
                    "nome": "Administrador Master",
                    "email": "admin@icet.ufam.edu.br",
                    "siape": "0000000",
                    "password_hash": make_password("admin1234"),
                    "group": admin_group,
                    "role": "admin",
                    "active": True,
                    "approval_status": "approved",
                    "first_login_required": False,
                },
            )
            docente, _ = User.objects.update_or_create(
                id=2,
                defaults={
                    "nome": "Mariana Costa",
                    "login": "docente",
                    "email": "mariana.costa@ufam.edu.br",
                    "siape": "2314578",
                    "cargo": "Docente",
                    "password_hash": make_password("Docente@1234"),
                    "group": docente_group,
                    "role": "user",
                    "active": True,
                    "approval_status": "approved",
                    "first_login_required": False,
                },
            )
            tecnico, _ = User.objects.update_or_create(
                id=3,
                defaults={
                    "nome": "Rafael Lima",
                    "login": "tecnico",
                    "email": "rafael.lima@ufam.edu.br",
                    "siape": "1987643",
                    "cargo": "Técnico Administrativo em Educação",
                    "password_hash": make_password("Tecnico@1234"),
                    "group": tecnico_group,
                    "role": "user",
                    "active": True,
                    "approval_status": "approved",
                    "first_login_required": False,
                },
            )

            for nome, prazo in [
                ("Manutenção de Hardware", "2 dias úteis"),
                ("Redes de Computadores", "1 dia útil"),
                ("Suporte Audiovisual", "1 dia útil"),
                ("Instalação de Software", "3 dias úteis"),
            ]:
                Demand.objects.update_or_create(nome=nome, defaults={"prazo": prazo})

            if not ServiceRequest.objects.exists():
                samples = [
                    (
                        docente,
                        {
                            "nome": "Mariana Costa",
                            "siape": "2314578",
                            "email": "mariana.costa@ufam.edu.br",
                            "perfil": "Docente",
                            "bloco": "Bloco B",
                            "sala": "Laboratório 03",
                            "categoria": "Manutenção de Hardware",
                            "descricao": "Computador não liga após queda de energia.",
                            "status": "Aberto",
                        },
                    ),
                    (
                        tecnico,
                        {
                            "nome": "Rafael Lima",
                            "siape": "1987643",
                            "email": "rafael.lima@ufam.edu.br",
                            "perfil": "Técnico Administrativo em Educação",
                            "bloco": "Bloco A",
                            "sala": "Secretaria",
                            "categoria": "Redes de Computadores",
                            "descricao": "Impressora de rede sem comunicação.",
                            "status": "Em Atendimento",
                        },
                    ),
                    (
                        docente,
                        {
                            "nome": "Ana Beatriz",
                            "siape": "2245789",
                            "email": "ana.beatriz@ufam.edu.br",
                            "perfil": "Docente",
                            "bloco": "Bloco C",
                            "sala": "Sala 12",
                            "categoria": "Suporte Audiovisual",
                            "descricao": "Projetor apresenta falha intermitente.",
                            "status": "Resolvido",
                        },
                    ),
                ]
                for owner, payload in samples:
                    item = create_request_record(payload, owner)
                    Interaction.objects.create(
                        request=item,
                        user=owner,
                        autor_nome=owner.nome,
                        autor_grupo=owner.group.nome,
                        mensagem="Solicitação cadastrada no sistema.",
                        tipo="sistema",
                    )

        self.stdout.write(self.style.SUCCESS("Dados iniciais criados/atualizados."))
