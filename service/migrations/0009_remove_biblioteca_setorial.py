from django.db import migrations


REMOVED_NAME = "Biblioteca Setorial"


def first_target_block(Block, location_id, excluded_block_id=None):
    candidates = Block.objects.filter(location_id=location_id).exclude(id=excluded_block_id)
    return (
        candidates.filter(active=True, nome__iexact="Bloco A").first()
        or candidates.filter(active=True).order_by("id").first()
        or candidates.order_by("id").first()
    )


def remove_biblioteca_setorial(apps, schema_editor):
    Location = apps.get_model("service", "Location")
    Block = apps.get_model("service", "Block")
    ServiceRequest = apps.get_model("service", "ServiceRequest")

    for block in list(Block.objects.filter(nome__iexact=REMOVED_NAME)):
        target = first_target_block(Block, block.location_id, block.id)
        if not target:
            target = Block.objects.create(location_id=block.location_id, nome="Bloco A", active=True)
        ServiceRequest.objects.filter(block_id=block.id).update(
            location_id=target.location_id,
            block_id=target.id,
        )
        block.delete()

    for location in list(Location.objects.filter(nome__iexact=REMOVED_NAME)):
        other_locations = Location.objects.exclude(id=location.id)
        target_location = (
            other_locations.filter(active=True).order_by("id").first()
            or other_locations.order_by("id").first()
        )
        if not target_location:
            target_location = Location.objects.create(nome="ICET", active=True)
        target = first_target_block(Block, target_location.id)
        if not target:
            target = Block.objects.create(location_id=target_location.id, nome="Bloco A", active=True)
        ServiceRequest.objects.filter(location_id=location.id).update(
            location_id=target_location.id,
            block_id=target.id,
        )
        location.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("service", "0008_service_request_location_block_foreign_keys"),
    ]

    operations = [
        migrations.RunPython(remove_biblioteca_setorial, migrations.RunPython.noop),
    ]
