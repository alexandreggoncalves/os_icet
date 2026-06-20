from django.db import migrations


def set_master_admin_siape(apps, schema_editor):
    User = apps.get_model("service", "User")
    master = User.objects.filter(login="admin").first()
    if not master or master.siape:
        return
    if User.objects.filter(siape="0000000").exclude(id=master.id).exists():
        raise RuntimeError("O SIAPE 0000000 ja pertence a outro usuario.")
    master.siape = "0000000"
    master.save(update_fields=["siape"])


class Migration(migrations.Migration):
    dependencies = [
        ("service", "0002_accessgroup_active_demand_active"),
    ]

    operations = [
        migrations.RunPython(set_master_admin_siape, migrations.RunPython.noop),
    ]
