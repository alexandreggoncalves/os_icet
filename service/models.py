from django.db import models
from django.utils import timezone


class AccessGroup(models.Model):
    nome = models.CharField(max_length=160, unique=True)
    descricao = models.TextField(blank=True, default="")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "groups"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class User(models.Model):
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
        db_table = "users"
        ordering = ["nome"]

    def __str__(self):
        return self.login


class Demand(models.Model):
    nome = models.CharField(max_length=180, unique=True)
    prazo = models.CharField(max_length=120, default="2 dias úteis")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "demands"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class ServiceRequest(models.Model):
    protocolo = models.CharField(max_length=32, unique=True)
    owner_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, db_column="owner_user_id")
    nome = models.CharField(max_length=180)
    siape = models.CharField(max_length=40)
    email = models.EmailField()
    perfil = models.CharField(max_length=120)
    bloco = models.CharField(max_length=120)
    sala = models.CharField(max_length=120)
    categoria = models.CharField(max_length=180)
    descricao = models.TextField()
    status = models.CharField(max_length=40, default="Aberto")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "requests"
        ordering = ["-id"]

    def __str__(self):
        return self.protocolo

    @property
    def localizacao(self):
        return f"{self.bloco} - {self.sala}"


class Interaction(models.Model):
    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name="interactions")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="interactions")
    autor_nome = models.CharField(max_length=180)
    autor_grupo = models.CharField(max_length=160)
    mensagem = models.TextField()
    tipo = models.CharField(max_length=40, default="mensagem")
    created_at = models.DateTimeField(default=timezone.now)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "interactions"
        ordering = ["id"]


class Attachment(models.Model):
    interaction = models.ForeignKey(Interaction, on_delete=models.CASCADE, related_name="attachments")
    original_name = models.CharField(max_length=255)
    stored_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=160)
    size = models.PositiveIntegerField()
    url = models.CharField(max_length=512)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "attachments"
        ordering = ["id"]


class PasswordReset(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_resets")
    code_hash = models.CharField(max_length=256)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "password_resets"
        ordering = ["-id"]


class SessionToken(models.Model):
    token = models.CharField(max_length=128, unique=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "session_tokens"
