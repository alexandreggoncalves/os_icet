from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.urls import path, re_path

from service import views


urlpatterns = [
    path("", views.index, name="index"),
    path("index.html", views.index, name="index_html"),
    path("api/public/bootstrap", views.public_bootstrap),
    path("api/admin/bootstrap", views.admin_bootstrap),
    path("api/auth/login", views.login),
    path("api/auth/register", views.register_user),
    path("api/auth/forgot-password", views.forgot_password),
    path("api/auth/reset-password", views.reset_password),
    path("api/auth/complete-first-access", views.complete_first_access),
    path("api/requests", views.requests_collection),
    path("api/requests/<int:request_id>", views.request_detail_view),
    path("api/requests/<int:request_id>/status", views.request_status),
    path("api/requests/<int:request_id>/interactions", views.create_interaction),
    path("api/interactions/<int:interaction_id>", views.edit_interaction),
    path("api/attachments/<int:attachment_id>", views.delete_attachment),
    path("api/groups", views.groups_collection),
    path("api/groups/<int:group_id>", views.update_group),
    path("api/users", views.users_collection),
    path("api/users/<int:user_id>", views.update_user),
    path("api/users/<int:user_id>/approve", views.approve_user),
    path("api/demands", views.demands_collection),
    path("api/demands/<int:demand_id>", views.update_demand),
    re_path(r"^(?P<path>(assets|vendor)/.*)$", serve, {"document_root": settings.BASE_DIR / "static"}),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
