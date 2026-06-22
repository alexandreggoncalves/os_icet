from django.contrib.auth.hashers import make_password
from django.core.management.color import no_style
from django.core.management.base import BaseCommand
from django.db import connection
from django.db import transaction
from django.utils import timezone

from service.models import AccessGroup, Block, Demand, Interaction, Location, ServiceRequest, User
from service.views import create_request_record


DEMO_PASSWORD = "Demo@1234"


class Command(BaseCommand):
    """Popula a base com dados ricos para demonstrações e homologação."""

    help = "Popula a base local com usuarios, solicitacoes e interacoes de demonstracao."

    def handle(self, *args, **options):
        """Orquestra criação idempotente de usuários, cadastros e solicitações demo."""
        with transaction.atomic():
            admin_group = AccessGroup.objects.get(nome="Administradores")
            docente_group = AccessGroup.objects.get(nome="Docentes")
            tecnico_group = AccessGroup.objects.get(nome="Técnicos Administrativos")

            admin = User.objects.select_related("group").get(login="admin")
            self.reset_sequences()
            demo_users = self.create_demo_users(docente_group, tecnico_group)
            self.create_demands()
            self.create_locations_and_blocks()

            demo_emails = [user.email for user in demo_users]
            ServiceRequest.objects.filter(email__in=demo_emails).delete()

            requests_created = self.create_requests(admin, demo_users)

        self.stdout.write(
            self.style.SUCCESS(
                f"Dados de demonstracao criados/atualizados: {len(demo_users)} usuarios, "
                f"{len(requests_created)} solicitacoes e "
                f"{Interaction.objects.filter(request__in=requests_created).count()} interacoes."
            )
        )
        self.stdout.write(f"Senha dos usuarios demo: {DEMO_PASSWORD}")

    def reset_sequences(self):
        """Realinha sequências do PostgreSQL após cargas que usam objetos conhecidos."""
        sequence_sql = connection.ops.sequence_reset_sql(
            no_style(), [AccessGroup, Block, Demand, Interaction, Location, ServiceRequest, User]
        )
        with connection.cursor() as cursor:
            for statement in sequence_sql:
                cursor.execute(statement)

    def create_demo_users(self, docente_group, tecnico_group):
        """Cria usuários aprovados para simular solicitantes de grupos diferentes."""
        specs = [
            {
                "nome": "Carla Menezes",
                "login": "carla.menezes",
                "email": "carla.menezes@ufam.edu.br",
                "siape": "3021456",
                "cargo": "Docente",
                "group": docente_group,
            },
            {
                "nome": "Paulo Andrade",
                "login": "paulo.andrade",
                "email": "paulo.andrade@ufam.edu.br",
                "siape": "3021457",
                "cargo": "Docente",
                "group": docente_group,
            },
            {
                "nome": "Luciana Rocha",
                "login": "luciana.rocha",
                "email": "luciana.rocha@ufam.edu.br",
                "siape": "3021458",
                "cargo": "Técnico Administrativo em Educação",
                "group": tecnico_group,
            },
            {
                "nome": "Bruno Almeida",
                "login": "bruno.almeida",
                "email": "bruno.almeida@ufam.edu.br",
                "siape": "3021459",
                "cargo": "Técnico Administrativo em Educação",
                "group": tecnico_group,
            },
            {
                "nome": "Fernanda Sousa",
                "login": "fernanda.sousa",
                "email": "fernanda.sousa@ufam.edu.br",
                "siape": "3021460",
                "cargo": "Docente",
                "group": docente_group,
            },
            {
                "nome": "Diego Nascimento",
                "login": "diego.nascimento",
                "email": "diego.nascimento@ufam.edu.br",
                "siape": "3021461",
                "cargo": "Técnico Administrativo em Educação",
                "group": tecnico_group,
            },
        ]
        users = []
        for spec in specs:
            user, _ = User.objects.update_or_create(
                login=spec["login"],
                defaults={
                    "nome": spec["nome"],
                    "email": spec["email"],
                    "siape": spec["siape"],
                    "cargo": spec["cargo"],
                    "password_hash": make_password(DEMO_PASSWORD),
                    "group": spec["group"],
                    "role": "user",
                    "active": True,
                    "approval_status": "approved",
                    "first_login_required": False,
                    "approved_at": timezone.now(),
                },
            )
            users.append(user)
        return users

    def create_demands(self):
        """Garante demandas adicionais usadas nos cenários demonstrativos."""
        for nome, prazo in [
            ("Manutenção Predial", "5 dias úteis"),
            ("Telefonia e Ramais", "2 dias úteis"),
            ("Acesso a Sistemas", "1 dia útil"),
            ("Mobiliário e Infraestrutura", "7 dias úteis"),
        ]:
            Demand.objects.update_or_create(nome=nome, defaults={"prazo": prazo})

    def create_locations_and_blocks(self):
        """Garante locais e blocos usados pelas solicitações de demonstração."""
        specs = {
            "ICET": ["Bloco A", "Bloco B", "Bloco C", "Bloco D", "Bloco Administrativo"],
            "Biblioteca Setorial": ["Atendimento"],
        }
        for location_name, blocks in specs.items():
            location, _ = Location.objects.update_or_create(nome=location_name, defaults={"active": True})
            for block_name in blocks:
                Block.objects.update_or_create(location=location, nome=block_name, defaults={"active": True})

    def create_requests(self, admin, users):
        """Cria solicitações de exemplo com status e interações variadas."""
        by_login = {user.login: user for user in users}
        specs = [
            {
                "owner": by_login["carla.menezes"],
                "status": "Aberto",
                "local": "ICET",
                "bloco": "Bloco B",
                "sala": "102",
                "categoria": "Manutenção de Hardware",
                "descricao": "Computador do laboratório apresenta desligamentos durante as aulas práticas.",
                "interactions": [
                    ("sistema", "Solicitação cadastrada no sistema."),
                    ("mensagem", "O equipamento está identificado com etiqueta ICET-LQ-014 e disponível para vistoria pela manhã."),
                ],
            },
            {
                "owner": by_login["paulo.andrade"],
                "status": "Aberto",
                "local": "ICET",
                "bloco": "Bloco C",
                "sala": "118",
                "categoria": "Instalação de Software",
                "descricao": "Solicito instalação do QGIS e atualização do pacote LibreOffice para disciplina de geoprocessamento.",
                "interactions": [
                    ("sistema", "Solicitação cadastrada no sistema."),
                    ("mensagem", "As aulas começam na próxima semana; posso deixar a sala liberada no período vespertino."),
                ],
            },
            {
                "owner": by_login["luciana.rocha"],
                "status": "Aberto",
                "local": "ICET",
                "bloco": "Bloco A",
                "sala": "101",
                "categoria": "Telefonia e Ramais",
                "descricao": "Ramal da coordenação está mudo e não recebe ligações externas.",
                "interactions": [
                    ("sistema", "Solicitação cadastrada no sistema."),
                ],
            },
            {
                "owner": by_login["bruno.almeida"],
                "status": "Em Atendimento",
                "local": "ICET",
                "bloco": "Bloco Administrativo",
                "sala": "201",
                "categoria": "Redes de Computadores",
                "descricao": "Estações da secretaria estão sem acesso ao sistema acadêmico pela rede cabeada.",
                "interactions": [
                    ("sistema", "Solicitação cadastrada no sistema."),
                    ("mensagem", "Equipe de suporte iniciou verificação do switch da sala."),
                    ("mensagem", "Identificado ponto de rede sem link. Será feita substituição do patch cord e novo teste."),
                ],
            },
            {
                "owner": by_login["fernanda.sousa"],
                "status": "Em Atendimento",
                "local": "ICET",
                "bloco": "Bloco D",
                "sala": "001",
                "categoria": "Suporte Audiovisual",
                "descricao": "Microfone sem fio apresenta ruídos constantes durante seminários.",
                "interactions": [
                    ("sistema", "Solicitação cadastrada no sistema."),
                    ("mensagem", "Evento previsto para sexta-feira; solicito prioridade se possível."),
                    ("mensagem", "Reserva feita de microfone substituto até conclusão do diagnóstico."),
                ],
            },
            {
                "owner": by_login["diego.nascimento"],
                "status": "Em Atendimento",
                "local": "Biblioteca Setorial",
                "bloco": "Biblioteca Setorial",
                "sala": "010",
                "categoria": "Acesso a Sistemas",
                "descricao": "Usuários do atendimento relatam erro ao autenticar no sistema de patrimônio.",
                "interactions": [
                    ("sistema", "Solicitação cadastrada no sistema."),
                    ("mensagem", "Chamado encaminhado para análise de permissões e sincronização de contas."),
                    ("mensagem", "Dois usuários já voltaram a acessar; falta validar uma conta remanescente."),
                ],
            },
            {
                "owner": by_login["carla.menezes"],
                "status": "Resolvido",
                "local": "ICET",
                "bloco": "Bloco B",
                "sala": "101",
                "categoria": "Mobiliário e Infraestrutura",
                "descricao": "Bancada próxima à pia está com tomada solta e precisa de isolamento.",
                "interactions": [
                    ("sistema", "Solicitação cadastrada no sistema."),
                    ("mensagem", "Área isolada preventivamente até avaliação."),
                    ("mensagem", "Tomada substituída e bancada liberada para uso."),
                ],
            },
            {
                "owner": by_login["paulo.andrade"],
                "status": "Resolvido",
                "local": "ICET",
                "bloco": "Bloco C",
                "sala": "104",
                "categoria": "Manutenção de Hardware",
                "descricao": "Projetor do laboratório não reconhecia entrada HDMI do computador principal.",
                "interactions": [
                    ("sistema", "Solicitação cadastrada no sistema."),
                    ("mensagem", "Cabo HDMI e adaptador testados pela equipe técnica."),
                    ("mensagem", "Entrada selecionada corretamente e cabo defeituoso substituído."),
                ],
            },
            {
                "owner": by_login["luciana.rocha"],
                "status": "Resolvido",
                "local": "ICET",
                "bloco": "Bloco A",
                "sala": "100",
                "categoria": "Manutenção Predial",
                "descricao": "Lâmpadas queimadas no corredor de acesso ao protocolo.",
                "interactions": [
                    ("sistema", "Solicitação cadastrada no sistema."),
                    ("mensagem", "Troca realizada pela manutenção predial no período da manhã."),
                ],
            },
        ]

        created = []
        base_time = timezone.now() - timezone.timedelta(days=9)
        for index, spec in enumerate(specs):
            owner = spec["owner"]
            item = create_request_record(
                {
                    "nome": owner.nome,
                    "siape": owner.siape,
                    "email": owner.email,
                    "perfil": owner.group.nome,
                    "local": spec["local"],
                    "bloco": spec["bloco"],
                    "sala": spec["sala"],
                    "categoria": spec["categoria"],
                    "descricao": spec["descricao"],
                    "status": spec["status"],
                },
                owner,
            )
            created_at = base_time + timezone.timedelta(days=index)
            item.created_at = created_at
            item.updated_at = created_at + timezone.timedelta(hours=len(spec["interactions"]))
            item.save(update_fields=["created_at", "updated_at"])
            created.append(item)

            for offset, (kind, message) in enumerate(spec["interactions"]):
                user = owner if kind == "sistema" else admin if offset > 1 else owner
                Interaction.objects.create(
                    request=item,
                    user=user,
                    autor_nome=user.nome,
                    autor_grupo=user.group.nome if user.group_id else "",
                    mensagem=message,
                    tipo=kind,
                    created_at=created_at + timezone.timedelta(hours=offset),
                )
        return created
