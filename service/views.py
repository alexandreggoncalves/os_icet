from pathlib import Path
import json
import re
import secrets

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.hashers import check_password, make_password

from .models import AccessGroup, Attachment, Demand, Interaction, PasswordReset, ServiceRequest, SessionToken, User


ALLOWED_UPLOAD_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".doc", ".docx"}


def index(request):
    return render(request, "index.html")


def api_response(payload, status=200):
    return JsonResponse(payload, status=status, json_dumps_params={"ensure_ascii": False})


def read_json(request):
    if not request.body:
        return {}
    return json.loads(request.body.decode("utf-8"))


def format_dt(value):
    if not value:
        return None
    return timezone.localtime(value).strftime("%Y-%m-%d %H:%M:%S")


def password_validation_error(password):
    special_chars = set("!@#$%^&*()-_=+[]{};:,.?/\\|`~'\"<>")
    if len(password or "") < 8:
        return "A senha deve ter pelo menos 8 caracteres."
    if not any(char.isupper() for char in password):
        return "A senha deve conter pelo menos uma letra maiúscula."
    if not any(char in special_chars for char in password):
        return "A senha deve conter pelo menos um caractere especial."
    return ""


def is_ufam_email(email):
    return bool(re.match(r"^[^@\s]+@ufam\.edu\.br$", email or "", re.IGNORECASE))


def login_from_email(email):
    return str(email).split("@", 1)[0].lower().strip()


def normalize_institutional_login(login):
    return str(login or "").split("@", 1)[0].lower().strip()


def institutional_email(login):
    return f"{normalize_institutional_login(login)}@ufam.edu.br"


def valid_institutional_login(login):
    return bool(re.fullmatch(r"[a-z0-9._-]+", normalize_institutional_login(login), re.IGNORECASE))


def valid_siape(siape):
    return bool(re.fullmatch(r"\d{7}", str(siape or "")))


def group_id_for_cargo(cargo):
    normalized = str(cargo or "").lower()
    if "docente" in normalized or "professor" in normalized:
        return 2
    return 3


def generate_temporary_password():
    return f"Ufam@{secrets.randbelow(1000000):06d}"


def group_dict(group):
    return {
        "id": group.id,
        "nome": group.nome,
        "descricao": group.descricao,
        "active": group.active,
        "created_at": format_dt(group.created_at),
    }


def demand_dict(demand):
    return {
        "id": demand.id,
        "nome": demand.nome,
        "prazo": demand.prazo,
        "active": demand.active,
        "created_at": format_dt(demand.created_at),
    }


def user_dict(user):
    grupo_nome = user.group.nome if user.group_id else ""
    return {
        "id": user.id,
        "nome": user.nome,
        "login": user.login,
        "email": user.email,
        "group_id": user.group_id,
        "grupo_id": user.group_id,
        "siape": user.siape,
        "cargo": user.cargo,
        "role": user.role,
        "grupo_nome": grupo_nome,
        "active": user.active,
        "approval_status": user.approval_status,
        "first_login_required": user.first_login_required,
        "approved_at": format_dt(user.approved_at),
        "created_at": format_dt(user.created_at),
    }


def request_dict(item, demand_deadlines=None):
    if demand_deadlines is None:
        estimated_deadline = Demand.objects.filter(nome=item.categoria).values_list("prazo", flat=True).first()
    else:
        estimated_deadline = demand_deadlines.get(item.categoria)
    return {
        "id": item.id,
        "protocolo": item.protocolo,
        "owner_user_id": item.owner_user_id,
        "nome": item.nome,
        "siape": item.siape,
        "email": item.email,
        "perfil": item.perfil,
        "bloco": item.bloco,
        "sala": item.sala,
        "categoria": item.categoria,
        "prazo_estimado": estimated_deadline or "Não informado",
        "descricao": item.descricao,
        "status": item.status,
        "created_at": format_dt(item.created_at),
        "updated_at": format_dt(item.updated_at),
        "localizacao": item.localizacao,
    }


def attachment_dict(item):
    return {
        "id": item.id,
        "interaction_id": item.interaction_id,
        "original_name": item.original_name,
        "stored_name": item.stored_name,
        "content_type": item.content_type,
        "size": item.size,
        "url": item.url,
        "created_at": format_dt(item.created_at),
    }


def interaction_dict(item):
    return {
        "id": item.id,
        "request_id": item.request_id,
        "user_id": item.user_id,
        "autor_nome": item.autor_nome,
        "autor_grupo": item.autor_grupo,
        "mensagem": item.mensagem,
        "tipo": item.tipo,
        "created_at": format_dt(item.created_at),
        "edited_at": format_dt(item.edited_at),
        "attachments": [attachment_dict(attachment) for attachment in item.attachments.all()],
    }


def request_detail_payload(item):
    data = request_dict(item)
    data["interactions"] = [interaction_dict(interaction) for interaction in item.interactions.prefetch_related("attachments")]
    return data


def is_admin(user):
    return bool(user and (user.role == "admin" or (user.group and user.group.nome == "Administradores")))


def is_protected_admin_group(group):
    return group.nome.strip().casefold() == "administradores"


def is_primary_admin(user):
    return bool(user and (user.id == 1 or user.login == "admin"))


def is_resolved_status(status):
    return str(status or "").strip().lower() == "resolvido"


def can_access_request(user, item):
    return bool(is_admin(user) or item.owner_user_id == user.id or item.email == user.email)


def current_user(request):
    header = request.headers.get("Authorization", "")
    token = header.replace("Bearer ", "").strip()
    if not token:
        return None
    SessionToken.objects.filter(expires_at__lt=timezone.now()).delete()
    session = SessionToken.objects.select_related("user__group").filter(token=token, expires_at__gte=timezone.now()).first()
    if not session or not session.user.active:
        return None
    return session.user


def require_user(request):
    user = current_user(request)
    if not user:
        return None, api_response({"detail": "Acesso não autorizado. Faça login novamente."}, 401)
    return user, None


def admin_payload(user):
    demand_items = list(Demand.objects.all())
    visible_demands = demand_items if is_admin(user) else [item for item in demand_items if item.active]
    demands = [demand_dict(item) for item in visible_demands]
    demand_deadlines = {item.nome: item.prazo for item in demand_items}
    groups = [group_dict(item) for item in AccessGroup.objects.all()]
    users = [user_dict(item) for item in User.objects.select_related("group").order_by("-approval_status", "nome")]
    if is_admin(user):
        requests = [request_dict(item, demand_deadlines) for item in ServiceRequest.objects.all()]
    else:
        requests = [
            request_dict(item, demand_deadlines)
            for item in ServiceRequest.objects.filter(owner_user=user) | ServiceRequest.objects.filter(email=user.email)
        ]
        groups = []
        users = []
    return {
        "user": user_dict(user),
        "permissions": {
            "admin": is_admin(user),
            "can_manage": is_admin(user),
            "can_update_status": is_admin(user),
            "can_reports": is_admin(user),
            "can_create_requests": True,
            "can_view_own_requests": True,
        },
        "groups": groups,
        "users": users,
        "demands": demands,
        "requests": requests,
    }


def write_reset_email(email, code):
    settings.DEV_MAILBOX_DIR.mkdir(exist_ok=True)
    safe_email = "".join(char if char.isalnum() else "_" for char in email)
    path = settings.DEV_MAILBOX_DIR / f"reset_{safe_email}.txt"
    path.write_text(
        "\n".join(
            [
                "Sistema OS ICET/UFAM",
                "Recuperação de senha",
                "",
                f"Código de verificação: {code}",
                "Validade: 15 minutos",
                "",
                "Se você não solicitou esta recuperação, ignore esta mensagem.",
            ]
        ),
        encoding="utf-8",
    )


def write_approval_email(user, temporary_password):
    settings.DEV_MAILBOX_DIR.mkdir(exist_ok=True)
    safe_email = "".join(char if char.isalnum() else "_" for char in user.email)
    path = settings.DEV_MAILBOX_DIR / f"approved_{safe_email}.txt"
    path.write_text(
        "\n".join(
            [
                "Sistema OS ICET/UFAM",
                "Cadastro aprovado",
                "",
                f"Olá, {user.nome}.",
                "Seu cadastro foi aprovado pela administração do sistema.",
                "",
                f"Login: {user.login}",
                f"Senha provisória: {temporary_password}",
                "",
                "No primeiro acesso, informe a senha provisória recebida e cadastre uma nova senha definitiva.",
            ]
        ),
        encoding="utf-8",
    )


@csrf_exempt
@require_http_methods(["GET"])
def public_bootstrap(request):
    return api_response({"demands": [demand_dict(item) for item in Demand.objects.filter(active=True)]})


@csrf_exempt
@require_http_methods(["GET"])
def admin_bootstrap(request):
    user, response = require_user(request)
    if response:
        return response
    return api_response(admin_payload(user))


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    payload = read_json(request)
    login_value = payload.get("login", "").strip()
    password = payload.get("password", "")
    user = User.objects.select_related("group").filter(login=login_value).first()
    if not user or not check_password(password, user.password_hash):
        return api_response({"detail": "Credenciais inválidas."}, 401)
    if user.approval_status == "pending":
        return api_response({"detail": "Cadastro pendente de validação pelo administrador."}, 403)
    if user.approval_status != "approved":
        return api_response({"detail": "Cadastro não aprovado. Procure a administração do sistema."}, 403)
    if not user.active:
        return api_response({"detail": "Usuário desativado. Procure a administração do sistema."}, 403)
    token = secrets.token_urlsafe(32)
    SessionToken.objects.create(token=token, user=user, expires_at=timezone.now() + timezone.timedelta(hours=8))
    return api_response(
        {
            "access_token": token,
            "token_type": "bearer",
            "user": user_dict(user),
            "first_login_required": bool(user.first_login_required),
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def register_user(request):
    payload = read_json(request)
    nome = payload.get("nome", "").strip()
    login_value = normalize_institutional_login(payload.get("login") or login_from_email(payload.get("email", "")))
    email = institutional_email(login_value)
    siape = payload.get("siape", "").strip()
    cargo = payload.get("cargo", "").strip()
    if not nome or not login_value or not siape or not cargo:
        return api_response({"detail": "Informe nome, login institucional, SIAPE e cargo."}, 422)
    if not valid_institutional_login(login_value):
        return api_response({"detail": "Informe um login institucional válido, sem @ ou domínio."}, 422)
    if not valid_siape(siape):
        return api_response({"detail": "O SIAPE deve conter exatamente 7 dígitos."}, 422)
    duplicate = User.objects.filter(email__iexact=email).first() or User.objects.filter(login__iexact=login_value).first() or User.objects.filter(siape=siape).first()
    if duplicate:
        if duplicate.siape == siape:
            return api_response({"detail": "Já existe cadastro com este SIAPE."}, 422)
        return api_response({"detail": "Já existe cadastro com este e-mail institucional."}, 422)
    group = AccessGroup.objects.filter(id=group_id_for_cargo(cargo)).first()
    try:
        User.objects.create(
            nome=nome,
            login=login_value,
            email=email,
            siape=siape,
            cargo=cargo,
            password_hash=make_password(secrets.token_urlsafe(32)),
            group=group,
            role="user",
            active=False,
            approval_status="pending",
            first_login_required=True,
        )
    except IntegrityError:
        return api_response({"detail": "Já existe cadastro com este e-mail ou login."}, 422)
    return api_response({"mensagem": "Cadastro realizado com sucesso. Aguarde até 24h para o administrador validar seu acesso."}, 201)


@csrf_exempt
@require_http_methods(["POST"])
def complete_first_access(request):
    user, response = require_user(request)
    if response:
        return response
    payload = read_json(request)
    temporary_password = payload.get("temporary_password", "")
    new_password = payload.get("new_password", "")
    confirm_password = payload.get("confirm_password", "")
    if not temporary_password or not new_password or not confirm_password:
        return api_response({"detail": "Informe senha provisória, nova senha e confirmação."}, 422)
    if new_password != confirm_password:
        return api_response({"detail": "A confirmação da senha não confere."}, 422)
    validation_error = password_validation_error(new_password)
    if validation_error:
        return api_response({"detail": validation_error}, 422)
    user.refresh_from_db()
    if not user.first_login_required:
        return api_response({"detail": "Este usuário não possui troca obrigatória de senha pendente."}, 422)
    if not check_password(temporary_password, user.password_hash):
        return api_response({"detail": "Senha provisória inválida."}, 422)
    user.password_hash = make_password(new_password)
    user.first_login_required = False
    user.save(update_fields=["password_hash", "first_login_required"])
    return api_response({"mensagem": "Senha definitiva cadastrada com sucesso. Faça login novamente."})


@csrf_exempt
@require_http_methods(["POST"])
def forgot_password(request):
    payload = read_json(request)
    login_value = normalize_institutional_login(payload.get("login"))
    fallback_email = payload.get("email", "").strip().lower()
    if not login_value and is_ufam_email(fallback_email):
        login_value = login_from_email(fallback_email)
    if not valid_institutional_login(login_value):
        return api_response({"detail": "Informe um login institucional válido, sem @ ou domínio."}, 422)
    email = institutional_email(login_value)
    user = User.objects.filter(email__iexact=email).first()
    if user:
        code = f"{secrets.randbelow(1000000):06d}"
        PasswordReset.objects.create(user=user, code_hash=make_password(code), expires_at=timezone.now() + timezone.timedelta(minutes=15))
        write_reset_email(user.email, code)
    return api_response(
        {
            "mensagem": "Se o e-mail estiver cadastrado, um código de verificação foi enviado.",
            "ambiente_local": "Para testes locais, consulte a pasta dev_mailbox gerada pelo backend.",
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def reset_password(request):
    payload = read_json(request)
    email = payload.get("email", "").strip().lower()
    code = payload.get("code", "").strip()
    new_password = payload.get("new_password", "")
    confirm_password = payload.get("confirm_password", "")
    if not email or not code or not new_password:
        return api_response({"detail": "Informe e-mail, código e nova senha."}, 422)
    if not is_ufam_email(email):
        return api_response({"detail": "Use um e-mail institucional @ufam.edu.br."}, 422)
    if new_password != confirm_password:
        return api_response({"detail": "A confirmação da senha não confere."}, 422)
    validation_error = password_validation_error(new_password)
    if validation_error:
        return api_response({"detail": validation_error}, 422)
    user = User.objects.filter(email__iexact=email).first()
    reset = PasswordReset.objects.filter(user=user, used_at__isnull=True).first() if user else None
    if not user or not reset or reset.expires_at < timezone.now() or not check_password(code, reset.code_hash):
        return api_response({"detail": "Código inválido ou expirado."}, 422)
    user.password_hash = make_password(new_password)
    user.save(update_fields=["password_hash"])
    reset.used_at = timezone.now()
    reset.save(update_fields=["used_at"])
    return api_response({"mensagem": "Senha redefinida com sucesso. Faça login com a nova senha."})


def create_request_record(payload, owner_user=None):
    item = ServiceRequest.objects.create(
        protocolo="PENDENTE",
        owner_user=owner_user,
        nome=payload["nome"],
        siape=payload["siape"],
        email=payload["email"],
        perfil=payload["perfil"],
        bloco=payload["bloco"],
        sala=payload["sala"],
        categoria=payload["categoria"],
        descricao=payload["descricao"],
        status=payload.get("status", "Aberto"),
    )
    item.protocolo = f"OS-{timezone.localdate().year}-{item.id:05d}"
    item.save(update_fields=["protocolo"])
    return item


@csrf_exempt
@require_http_methods(["POST"])
def requests_collection(request):
    user, response = require_user(request)
    if response:
        return response
    payload = read_json(request)
    payload["nome"] = user.nome
    payload["siape"] = user.siape or ""
    payload["email"] = user.email
    payload["perfil"] = user.group.nome if user.group_id else ""
    owner_user = user
    required = ["nome", "siape", "email", "perfil", "bloco", "sala", "categoria", "descricao"]
    missing = [field for field in required if not str(payload.get(field, "")).strip()]
    if missing:
        return api_response({"detail": f"Campos obrigatórios ausentes: {', '.join(missing)}"}, 422)
    if not valid_siape(payload["siape"]):
        return api_response({"detail": "O SIAPE deve conter exatamente 7 dígitos."}, 422)
    with transaction.atomic():
        item = create_request_record(payload, owner_user)
        Interaction.objects.create(
            request=item,
            user=user,
            autor_nome=user.nome,
            autor_grupo=user.group.nome if user.group_id else "",
            mensagem="Solicitação cadastrada no sistema.",
            tipo="sistema",
        )
    return api_response({"request": request_dict(item)}, 201)


@csrf_exempt
@require_http_methods(["GET"])
def request_detail_view(request, request_id):
    user, response = require_user(request)
    if response:
        return response
    item = ServiceRequest.objects.prefetch_related("interactions__attachments").filter(id=request_id).first()
    if not item:
        return api_response({"detail": "Solicitação não encontrada."}, 404)
    if not can_access_request(user, item):
        return api_response({"detail": "Você não tem permissão para acessar esta solicitação."}, 403)
    return api_response({"request": request_detail_payload(item)})


@csrf_exempt
@require_http_methods(["PUT"])
def request_status(request, request_id):
    user, response = require_user(request)
    if response:
        return response
    if not is_admin(user):
        return api_response({"detail": "Seu grupo não tem permissão para atualizar status."}, 403)
    item = ServiceRequest.objects.filter(id=request_id).first()
    if not item:
        return api_response({"detail": "Solicitação não encontrada."}, 404)
    if is_resolved_status(item.status):
        return api_response({"detail": "Solicitação resolvida fica disponível apenas para leitura e impressão."}, 403)
    item.status = read_json(request).get("status", item.status)
    item.updated_at = timezone.now()
    item.save(update_fields=["status", "updated_at"])
    return api_response({"request": request_dict(item)})


def save_uploaded_files(files):
    saved = []
    settings.MEDIA_ROOT.mkdir(exist_ok=True)
    for file_obj in files:
        original = Path(file_obj.name).name
        ext = Path(original).suffix.lower()
        if ext not in ALLOWED_UPLOAD_EXTENSIONS:
            raise ValidationError(f"Tipo de arquivo não permitido: {ext or 'sem extensão'}")
        if file_obj.size > 8 * 1024 * 1024:
            raise ValidationError("Cada anexo deve ter no máximo 8 MB.")
        stem = re.sub(r"[^A-Za-z0-9_.-]+", "_", Path(original).stem).strip("._") or "arquivo"
        stored_name = f"{int(timezone.now().timestamp())}_{secrets.token_hex(8)}_{stem[:80]}{ext}"
        target = settings.MEDIA_ROOT / stored_name
        with target.open("wb") as handle:
            for chunk in file_obj.chunks():
                handle.write(chunk)
        saved.append(
            {
                "original_name": original,
                "stored_name": stored_name,
                "content_type": file_obj.content_type or "application/octet-stream",
                "size": file_obj.size,
                "url": f"/uploads/{stored_name}",
            }
        )
    return saved


@csrf_exempt
@require_http_methods(["POST"])
def create_interaction(request, request_id):
    user, response = require_user(request)
    if response:
        return response
    payload = request.POST if request.content_type and request.content_type.startswith("multipart/form-data") else read_json(request)
    mensagem = payload.get("mensagem", "").strip()
    files = request.FILES.getlist("attachments")
    if not mensagem and not files:
        return api_response({"detail": "Informe uma mensagem ou selecione pelo menos um anexo."}, 422)
    item = ServiceRequest.objects.filter(id=request_id).first()
    if not item:
        return api_response({"detail": "Solicitação não encontrada."}, 404)
    if not can_access_request(user, item):
        return api_response({"detail": "Você não tem permissão para interagir nesta solicitação."}, 403)
    if is_resolved_status(item.status):
        return api_response({"detail": "Solicitação resolvida fica disponível apenas para leitura e impressão."}, 403)
    try:
        saved_files = save_uploaded_files(files)
    except ValidationError as error:
        return api_response({"detail": f"Dados inválidos: {error.messages[0]}"}, 422)
    with transaction.atomic():
        interaction = Interaction.objects.create(
            request=item,
            user=user,
            autor_nome=user.nome,
            autor_grupo=user.group.nome if user.group_id else "",
            mensagem=mensagem,
            tipo="mensagem",
        )
        for saved in saved_files:
            Attachment.objects.create(interaction=interaction, **saved)
        item.updated_at = timezone.now()
        item.save(update_fields=["updated_at"])
    item = ServiceRequest.objects.prefetch_related("interactions__attachments").get(id=request_id)
    return api_response({"request": request_detail_payload(item)}, 201)


@csrf_exempt
@require_http_methods(["PUT"])
def edit_interaction(request, interaction_id):
    user, response = require_user(request)
    if response:
        return response
    mensagem = read_json(request).get("mensagem", "").strip()
    if not mensagem:
        return api_response({"detail": "Informe a mensagem da interação."}, 422)
    interaction = Interaction.objects.select_related("request").filter(id=interaction_id).first()
    if not interaction:
        return api_response({"detail": "Interação não encontrada."}, 404)
    if interaction.user_id != user.id:
        return api_response({"detail": "Somente o autor pode editar esta interação."}, 403)
    if not can_access_request(user, interaction.request):
        return api_response({"detail": "Você não tem permissão para acessar esta solicitação."}, 403)
    if is_resolved_status(interaction.request.status):
        return api_response({"detail": "Solicitação resolvida fica disponível apenas para leitura e impressão."}, 403)
    interaction.mensagem = mensagem
    interaction.edited_at = timezone.now()
    interaction.save(update_fields=["mensagem", "edited_at"])
    interaction.request.updated_at = timezone.now()
    interaction.request.save(update_fields=["updated_at"])
    item = ServiceRequest.objects.prefetch_related("interactions__attachments").get(id=interaction.request_id)
    return api_response({"request": request_detail_payload(item)})


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_attachment(request, attachment_id):
    user, response = require_user(request)
    if response:
        return response
    attachment = Attachment.objects.select_related("interaction__request").filter(id=attachment_id).first()
    if not attachment:
        return api_response({"detail": "Anexo não encontrado."}, 404)
    if attachment.interaction.user_id != user.id:
        return api_response({"detail": "Você não tem permissão para excluir este anexo."}, 403)
    item = attachment.interaction.request
    if is_resolved_status(item.status):
        return api_response({"detail": "Solicitação resolvida fica disponível apenas para leitura e impressão."}, 403)
    path = settings.MEDIA_ROOT / attachment.stored_name
    attachment.delete()
    if path.exists():
        path.unlink()
    item.updated_at = timezone.now()
    item.save(update_fields=["updated_at"])
    item = ServiceRequest.objects.prefetch_related("interactions__attachments").get(id=item.id)
    return api_response({"request": request_detail_payload(item)})


@csrf_exempt
@require_http_methods(["POST"])
def groups_collection(request):
    user, response = require_user(request)
    if response:
        return response
    if not is_admin(user):
        return api_response({"detail": "Seu grupo não tem permissão para cadastrar grupos."}, 403)
    payload = read_json(request)
    try:
        item = AccessGroup.objects.create(nome=payload["nome"].strip(), descricao=payload.get("descricao", "").strip())
    except (KeyError, IntegrityError) as error:
        return api_response({"detail": f"Dados inválidos: {error}"}, 422)
    return api_response({"item": group_dict(item)}, 201)


@csrf_exempt
@require_http_methods(["PUT"])
def update_group(request, group_id):
    user, response = require_user(request)
    if response:
        return response
    if not is_admin(user):
        return api_response({"detail": "Seu grupo não tem permissão para atualizar grupos."}, 403)
    item = AccessGroup.objects.filter(id=group_id).first()
    if not item:
        return api_response({"detail": "Grupo não encontrado."}, 404)
    if is_protected_admin_group(item):
        return api_response({"detail": "O grupo Administradores não pode ser editado ou desativado."}, 403)
    payload = read_json(request)
    item.nome = payload.get("nome", item.nome).strip()
    item.descricao = payload.get("descricao", item.descricao).strip()
    item.active = bool(payload.get("active", item.active))
    if not item.nome:
        return api_response({"detail": "Informe o nome do grupo."}, 422)
    try:
        item.save(update_fields=["nome", "descricao", "active"])
    except IntegrityError:
        return api_response({"detail": "Já existe um grupo com este nome."}, 422)
    return api_response({"item": group_dict(item)})


@csrf_exempt
@require_http_methods(["POST"])
def users_collection(request):
    user, response = require_user(request)
    if response:
        return response
    if not is_admin(user):
        return api_response({"detail": "Seu grupo não tem permissão para cadastrar usuários."}, 403)
    payload = read_json(request)
    nome = payload.get("nome", "").strip()
    login_value = normalize_institutional_login(payload.get("login"))
    siape = str(payload.get("siape", "")).strip()
    try:
        group_id = int(payload.get("grupo_id", 0) or 0)
    except (TypeError, ValueError):
        return api_response({"detail": "Grupo informado não encontrado."}, 422)
    if not nome or not login_value or not siape or not group_id:
        return api_response({"detail": "Informe nome, login, SIAPE e grupo."}, 422)
    if not valid_institutional_login(login_value):
        return api_response({"detail": "Informe um login institucional válido, sem @ ou domínio."}, 422)
    if not valid_siape(siape):
        return api_response({"detail": "O SIAPE deve conter exatamente 7 dígitos."}, 422)
    if not AccessGroup.objects.filter(id=group_id, active=True).exists():
        return api_response({"detail": "Grupo informado não encontrado."}, 422)
    if User.objects.filter(siape=siape).exists():
        return api_response({"detail": "Já existe cadastro com este SIAPE."}, 422)
    temporary_password = generate_temporary_password()
    try:
        item = User.objects.create(
            nome=nome,
            login=login_value,
            email=institutional_email(login_value),
            siape=siape,
            password_hash=make_password(temporary_password),
            group_id=group_id,
            role="user",
            active=True,
            approval_status="approved",
            first_login_required=True,
            approved_at=timezone.now(),
            approved_by=user,
        )
    except IntegrityError:
        return api_response({"detail": "Login ou e-mail já cadastrado para outro usuário."}, 422)
    item = User.objects.select_related("group").get(id=item.id)
    write_approval_email(item, temporary_password)
    return api_response(
        {
            "item": user_dict(item),
            "mensagem": "Usuário cadastrado. Senha provisória enviada pelo e-mail simulado.",
        },
        201,
    )


@csrf_exempt
@require_http_methods(["PUT"])
def update_user(request, user_id):
    acting_user, response = require_user(request)
    if response:
        return response
    if not is_admin(acting_user):
        return api_response({"detail": "Seu grupo não tem permissão para atualizar usuários."}, 403)
    item = User.objects.filter(id=user_id).first()
    if not item:
        return api_response({"detail": "Usuário não encontrado."}, 404)
    if is_primary_admin(item):
        return api_response({"detail": "O usuário administrador principal não pode ter seus dados editados ou ser desativado."}, 403)
    payload = read_json(request)
    active = bool(payload.get("active", item.active))
    if item.id == acting_user.id and not active:
        return api_response({"detail": "Você não pode desativar o próprio usuário em uso."}, 403)
    item.nome = payload.get("nome", item.nome).strip()
    item.login = normalize_institutional_login(payload.get("login", item.login))
    item.email = institutional_email(item.login)
    item.siape = str(payload.get("siape", item.siape or "")).strip()
    try:
        item.group_id = int(payload.get("grupo_id", item.group_id or 0) or 0)
    except (TypeError, ValueError):
        return api_response({"detail": "Grupo informado não encontrado."}, 422)
    item.active = active
    if not item.nome or not valid_institutional_login(item.login) or not item.group_id:
        return api_response({"detail": "Informe nome, login institucional válido, SIAPE e grupo."}, 422)
    if not valid_siape(item.siape):
        return api_response({"detail": "O SIAPE deve conter exatamente 7 dígitos."}, 422)
    if not AccessGroup.objects.filter(id=item.group_id, active=True).exists():
        return api_response({"detail": "Grupo informado não encontrado ou desativado."}, 422)
    if User.objects.filter(siape=item.siape).exclude(id=item.id).exists():
        return api_response({"detail": "Já existe cadastro com este SIAPE."}, 422)
    try:
        item.save(update_fields=["nome", "login", "email", "siape", "group", "active"])
    except IntegrityError:
        return api_response({"detail": "Login, e-mail ou SIAPE já cadastrado para outro usuário."}, 422)
    return api_response({"item": user_dict(User.objects.select_related("group").get(id=item.id))})


@csrf_exempt
@require_http_methods(["POST"])
def approve_user(request, user_id):
    acting_user, response = require_user(request)
    if response:
        return response
    if not is_admin(acting_user):
        return api_response({"detail": "Seu grupo não tem permissão para aprovar usuários."}, 403)
    item = User.objects.filter(id=user_id).first()
    if not item:
        return api_response({"detail": "Usuário não encontrado."}, 404)
    if item.approval_status != "pending":
        return api_response({"detail": "Este usuário não está pendente de aprovação."}, 422)
    payload = read_json(request)
    group_id = int(payload.get("grupo_id", 0) or item.group_id or group_id_for_cargo(item.cargo))
    if not AccessGroup.objects.filter(id=group_id, active=True).exists():
        return api_response({"detail": "Grupo informado não encontrado."}, 422)
    temporary_password = generate_temporary_password()
    item.group_id = group_id
    item.password_hash = make_password(temporary_password)
    item.active = True
    item.approval_status = "approved"
    item.first_login_required = True
    item.approved_at = timezone.now()
    item.approved_by = acting_user
    item.save(update_fields=["group", "password_hash", "active", "approval_status", "first_login_required", "approved_at", "approved_by"])
    item = User.objects.select_related("group").get(id=item.id)
    write_approval_email(item, temporary_password)
    return api_response({"item": user_dict(item), "mensagem": "Usuário aprovado. E-mail simulado de aprovação gerado em dev_mailbox."})


@csrf_exempt
@require_http_methods(["POST"])
def demands_collection(request):
    user, response = require_user(request)
    if response:
        return response
    if not is_admin(user):
        return api_response({"detail": "Seu grupo não tem permissão para cadastrar demandas."}, 403)
    payload = read_json(request)
    try:
        item = Demand.objects.create(nome=payload["nome"].strip(), prazo=payload.get("prazo", "2 dias úteis").strip())
    except (KeyError, IntegrityError) as error:
        return api_response({"detail": f"Dados inválidos: {error}"}, 422)
    return api_response({"item": demand_dict(item)}, 201)


@csrf_exempt
@require_http_methods(["PUT"])
def update_demand(request, demand_id):
    user, response = require_user(request)
    if response:
        return response
    if not is_admin(user):
        return api_response({"detail": "Seu grupo não tem permissão para atualizar demandas."}, 403)
    item = Demand.objects.filter(id=demand_id).first()
    if not item:
        return api_response({"detail": "Demanda não encontrada."}, 404)
    payload = read_json(request)
    old_name = item.nome
    item.nome = payload.get("nome", item.nome).strip()
    item.prazo = payload.get("prazo", item.prazo).strip()
    item.active = bool(payload.get("active", item.active))
    if not item.nome or not item.prazo:
        return api_response({"detail": "Informe o nome e o prazo da demanda."}, 422)
    try:
        with transaction.atomic():
            item.save(update_fields=["nome", "prazo", "active"])
            if old_name != item.nome:
                ServiceRequest.objects.filter(categoria=old_name).update(categoria=item.nome)
    except IntegrityError:
        return api_response({"detail": "Já existe uma demanda com este nome."}, 422)
    return api_response({"item": demand_dict(item)})
