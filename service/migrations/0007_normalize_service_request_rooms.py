from django.db import migrations


def normalize_service_request_rooms(apps, schema_editor):
    ServiceRequest = apps.get_model("service", "ServiceRequest")
    for index, request in enumerate(ServiceRequest.objects.order_by("id").iterator()):
        prefix = (index % 3) + 1
        suffix = ((index // 3) % 20) + 1
        request.sala = f"{prefix}{suffix:02d}"
        request.save(update_fields=["sala"])


class Migration(migrations.Migration):
    dependencies = [
        ("service", "0006_servicerequest_assigned_user"),
    ]

    operations = [
        migrations.RunPython(normalize_service_request_rooms, migrations.RunPython.noop),
    ]
