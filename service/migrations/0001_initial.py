import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="AccessGroup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nome", models.CharField(max_length=160, unique=True)),
                ("descricao", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "groups", "ordering": ["nome"]},
        ),
        migrations.CreateModel(
            name="Demand",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nome", models.CharField(max_length=180, unique=True)),
                ("prazo", models.CharField(default="2 dias úteis", max_length=120)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "demands", "ordering": ["nome"]},
        ),
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nome", models.CharField(max_length=180)),
                ("login", models.CharField(max_length=120, unique=True)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("password_hash", models.CharField(max_length=256)),
                ("siape", models.CharField(blank=True, max_length=40, null=True, unique=True)),
                ("cargo", models.CharField(blank=True, max_length=120, null=True)),
                ("role", models.CharField(default="user", max_length=20)),
                ("active", models.BooleanField(default=True)),
                ("approval_status", models.CharField(default="approved", max_length=20)),
                ("first_login_required", models.BooleanField(default=False)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("approved_by", models.ForeignKey(blank=True, db_column="approved_by", null=True, on_delete=django.db.models.deletion.SET_NULL, to="service.user")),
                ("group", models.ForeignKey(blank=True, db_column="group_id", null=True, on_delete=django.db.models.deletion.SET_NULL, to="service.accessgroup")),
            ],
            options={"db_table": "users", "ordering": ["nome"]},
        ),
        migrations.CreateModel(
            name="ServiceRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("protocolo", models.CharField(max_length=32, unique=True)),
                ("nome", models.CharField(max_length=180)),
                ("siape", models.CharField(max_length=40)),
                ("email", models.EmailField(max_length=254)),
                ("perfil", models.CharField(max_length=120)),
                ("bloco", models.CharField(max_length=120)),
                ("sala", models.CharField(max_length=120)),
                ("categoria", models.CharField(max_length=180)),
                ("descricao", models.TextField()),
                ("status", models.CharField(default="Aberto", max_length=40)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("owner_user", models.ForeignKey(blank=True, db_column="owner_user_id", null=True, on_delete=django.db.models.deletion.SET_NULL, to="service.user")),
            ],
            options={"db_table": "requests", "ordering": ["-id"]},
        ),
        migrations.CreateModel(
            name="Interaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("autor_nome", models.CharField(max_length=180)),
                ("autor_grupo", models.CharField(max_length=160)),
                ("mensagem", models.TextField()),
                ("tipo", models.CharField(default="mensagem", max_length=40)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("edited_at", models.DateTimeField(blank=True, null=True)),
                ("request", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="interactions", to="service.servicerequest")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="interactions", to="service.user")),
            ],
            options={"db_table": "interactions", "ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="Attachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("original_name", models.CharField(max_length=255)),
                ("stored_name", models.CharField(max_length=255)),
                ("content_type", models.CharField(max_length=160)),
                ("size", models.PositiveIntegerField()),
                ("url", models.CharField(max_length=512)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("interaction", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="service.interaction")),
            ],
            options={"db_table": "attachments", "ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="PasswordReset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code_hash", models.CharField(max_length=256)),
                ("expires_at", models.DateTimeField()),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="password_resets", to="service.user")),
            ],
            options={"db_table": "password_resets", "ordering": ["-id"]},
        ),
        migrations.CreateModel(
            name="SessionToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(max_length=128, unique=True)),
                ("expires_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sessions", to="service.user")),
            ],
            options={"db_table": "session_tokens"},
        ),
    ]
