from django.db import models
from django.utils import timezone


class AccessGroup(models.Model):
    """Grupo de acesso usado para permissões administrativas e perfis de usuários."""

    nome = models.CharField(max_length=160, unique=True)
    descricao = models.TextField(blank=True, default="")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        """Configura nome da tabela e ordenação padrão de grupos."""
        db_table = "groups"
        ordering = ["nome"]

    def __str__(self):
        """Retorna o nome do grupo em telas administrativas e shell."""
        return self.nome


class User(models.Model):
    """Usuário autenticável do sistema, incluindo aprovação, bloqueio e vínculo ao grupo."""

    nome = models.CharField(max_length=180)
    login = models.CharField(max_length=120, unique=True)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=256)
    group = models.ForeignKey(AccessGroup, null=True, blank=True, on_delete=models.SET_NULL, db_column="group_id")
    siape = models.CharField(max_length=40, null=True, blank=True, unique=True)
    cargo = models.CharField(max_length=120, null=True, blank=True)
    role = models.CharField(max_length=20, default="user")
    active = models.BooleanField(default=True)
    approval_status = models.CharField(max_length=20, default="approved")
    first_login_required = models.BooleanField(default=False)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, db_column="approved_by")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        """Configura nome da tabela e ordenação padrão de usuários."""
        db_table = "users"
        ordering = ["nome"]

    def __str__(self):
        """Retorna o login institucional como identificação curta."""
        return self.login


class Demand(models.Model):
    """Tipo de demanda que pode ser selecionado na abertura da solicitação."""

    nome = models.CharField(max_length=180, unique=True)
    prazo = models.CharField(max_length=120, default="2 dias úteis")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        """Configura nome da tabela e ordenação padrão de demandas."""
        db_table = "demands"
        ordering = ["nome"]

    def __str__(self):
        """Retorna o nome da demanda para uso administrativo."""
        return self.nome


class Location(models.Model):
    """Local físico macro, usado para agrupar blocos e organizar as solicitações."""

    nome = models.CharField(max_length=180, unique=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        """Configura nome da tabela e ordenação padrão de locais."""
        db_table = "locations"
        ordering = ["nome"]

    def __str__(self):
        """Retorna o nome do local para listas e seleções."""
        return self.nome


class Block(models.Model):
    """Bloco pertencente a um local; permite filtrar blocos conforme o local escolhido."""

    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="blocks", db_column="location_id")
    nome = models.CharField(max_length=180)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        """Configura tabela, ordenação e unicidade de bloco por local."""
        db_table = "blocks"
        ordering = ["location__nome", "nome"]
        unique_together = [("location", "nome")]

    def __str__(self):
        """Retorna local e bloco juntos para facilitar depuração."""
        return f"{self.location.nome} - {self.nome}"


class ServiceRequest(models.Model):
    """Solicitação de serviço aberta pelo usuário e acompanhada pela equipe de TI."""

    protocolo = models.CharField(max_length=32, unique=True)
    owner_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, db_column="owner_user_id")
    assigned_user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_requests",
        db_column="assigned_user_id",
    )
    nome = models.CharField(max_length=180)
    siape = models.CharField(max_length=40)
    email = models.EmailField()
    perfil = models.CharField(max_length=120)
    local = models.CharField(max_length=180, default="")
    bloco = models.CharField(max_length=120)
    sala = models.CharField(max_length=120)
    categoria = models.CharField(max_length=180)
    descricao = models.TextField()
    status = models.CharField(max_length=40, default="Aberto")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        """Configura nome da tabela e ordenação mais recente primeiro."""
        db_table = "requests"
        ordering = ["-id"]

    def __str__(self):
        """Retorna o protocolo público da solicitação."""
        return self.protocolo

    @property
    def localizacao(self):
        """Monta a localização legível exibida em consultas, detalhes e relatórios."""
        parts = [self.local, self.bloco, f"Sala {self.sala}" if self.sala else ""]
        return " - ".join(part for part in parts if part)


class Interaction(models.Model):
    """Registro de conversa, feedback ou ação automática dentro de uma solicitação."""

    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name="interactions")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="interactions")
    autor_nome = models.CharField(max_length=180)
    autor_grupo = models.CharField(max_length=160)
    mensagem = models.TextField()
    tipo = models.CharField(max_length=40, default="mensagem")
    created_at = models.DateTimeField(default=timezone.now)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        """Configura nome da tabela e ordem cronológica do histórico."""
        db_table = "interactions"
        ordering = ["id"]


class Attachment(models.Model):
    """Arquivo anexado a uma interação, mantendo nome original e caminho público."""

    interaction = models.ForeignKey(Interaction, on_delete=models.CASCADE, related_name="attachments")
    original_name = models.CharField(max_length=255)
    stored_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=160)
    size = models.PositiveIntegerField()
    url = models.CharField(max_length=512)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        """Configura nome da tabela e ordem de anexos por criação."""
        db_table = "attachments"
        ordering = ["id"]


class PasswordReset(models.Model):
    """Código temporário de recuperação de senha e seu controle de validade/uso."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_resets")
    code_hash = models.CharField(max_length=256)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        """Configura nome da tabela e consulta dos códigos mais recentes primeiro."""
        db_table = "password_resets"
        ordering = ["-id"]


class SessionToken(models.Model):
    """Token simples de sessão utilizado pelas chamadas autenticadas da API."""

    token = models.CharField(max_length=128, unique=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        """Configura nome da tabela de sessões de API."""
        db_table = "session_tokens"
