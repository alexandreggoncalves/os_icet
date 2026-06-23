import django.db.models.deletion
from django.db import migrations, models


def link_requests_to_locations_and_blocks(apps, schema_editor):
    Location = apps.get_model("service", "Location")
    Block = apps.get_model("service", "Block")
    ServiceRequest = apps.get_model("service", "ServiceRequest")

    for request in ServiceRequest.objects.order_by("id").iterator():
        location_name = (request.local or "Local legado").strip()
        block_name = (request.bloco or "Bloco legado").strip()
        location, _ = Location.objects.get_or_create(nome=location_name, defaults={"active": True})
        block, _ = Block.objects.get_or_create(
            location=location,
            nome=block_name,
            defaults={"active": True},
        )
        request.location_ref_id = location.id
        request.block_ref_id = block.id
        request.save(update_fields=["location_ref", "block_ref"])


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("service", "0007_normalize_service_request_rooms"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicerequest",
            name="location_ref",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="service.location",
                db_column="location_id",
            ),
        ),
        migrations.AddField(
            model_name="servicerequest",
            name="block_ref",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="service.block",
                db_column="block_id",
            ),
        ),
        migrations.RunPython(link_requests_to_locations_and_blocks, migrations.RunPython.noop),
        migrations.RemoveField(model_name="servicerequest", name="local"),
        migrations.RemoveField(model_name="servicerequest", name="bloco"),
        migrations.RenameField(model_name="servicerequest", old_name="location_ref", new_name="location"),
        migrations.RenameField(model_name="servicerequest", old_name="block_ref", new_name="block"),
        migrations.AlterField(
            model_name="servicerequest",
            name="location",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="requests",
                to="service.location",
                db_column="location_id",
            ),
        ),
        migrations.AlterField(
            model_name="servicerequest",
            name="block",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="requests",
                to="service.block",
                db_column="block_id",
            ),
        ),
    ]
