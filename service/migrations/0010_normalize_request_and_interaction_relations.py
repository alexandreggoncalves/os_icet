import django.db.models.deletion
from django.db import migrations, models


def link_requests_to_demands(apps, schema_editor):
    Demand = apps.get_model("service", "Demand")
    ServiceRequest = apps.get_model("service", "ServiceRequest")

    for request in ServiceRequest.objects.order_by("id").iterator():
        demand, _ = Demand.objects.get_or_create(
            nome=request.categoria,
            defaults={"prazo": "Nao informado", "active": False},
        )
        request.demand_ref_id = demand.id
        request.save(update_fields=["demand_ref"])


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("service", "0009_remove_biblioteca_setorial"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicerequest",
            name="demand_ref",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="service.demand",
                db_column="demand_id",
            ),
        ),
        migrations.RunPython(link_requests_to_demands, migrations.RunPython.noop),
        migrations.RemoveField(model_name="servicerequest", name="categoria"),
        migrations.RenameField(model_name="servicerequest", old_name="demand_ref", new_name="demand"),
        migrations.AlterField(
            model_name="servicerequest",
            name="demand",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="requests",
                to="service.demand",
                db_column="demand_id",
            ),
        ),
        migrations.AlterField(
            model_name="servicerequest",
            name="owner_user",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="owned_requests",
                to="service.user",
                db_column="owner_user_id",
            ),
        ),
        migrations.RemoveField(model_name="servicerequest", name="nome"),
        migrations.RemoveField(model_name="servicerequest", name="siape"),
        migrations.RemoveField(model_name="servicerequest", name="email"),
        migrations.RemoveField(model_name="servicerequest", name="perfil"),
        migrations.AlterField(
            model_name="interaction",
            name="user",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="interactions",
                to="service.user",
            ),
        ),
        migrations.RemoveField(model_name="interaction", name="autor_nome"),
        migrations.RemoveField(model_name="interaction", name="autor_grupo"),
        migrations.RemoveField(model_name="user", name="role"),
    ]
