const SB_URL = "https://vmorgejoxarkypgeavin.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtb3JnZWpveGFya3lwZ2VhdmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDAxODAsImV4cCI6MjA5MDExNjE4MH0.Snj2a7UVGvYhXfE8_1Rx-X91fupnPq-4A9fVMAj38jQ";

let supabaseClient;

function verificarAcceso(rolRequerido) {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    if (rolRequerido && user.roles.nombre_rol !== rolRequerido) {
        Swal.fire('Acceso Restringido', 'No tienes permisos para esta sección.', 'error')
            .then(() => window.location.href = 'index.html');
    }
}

// Función para obtener el cliente de forma segura
function getSupabase() {
    if (!supabaseClient) {
        // Si por alguna razón la librería no ha cargado, intentamos crearla
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SB_URL, SB_KEY);
        } else {
            console.error("La librería de Supabase no está cargada en el HTML");
        }
    }
    return supabaseClient;
}

async function login() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    const client = getSupabase();
    if (!client) {
        Swal.fire('Error', 'No se pudo inicializar la base de datos.', 'error');
        return;
    }
    if (!email || !pass) return;

    const {data, error} = await client
        .from('personas')
        .select('*, roles(nombre_rol)')
        .eq('email', email)
        .eq('password', pass)
        .single();

    if (data) {
        sessionStorage.setItem('usuario_logueado', JSON.stringify(data));

        Swal.fire({
            icon: 'success',
            title: `¡Bienvenido, ${data.nombre}!`,
            text: 'Accediendo al sistema...',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            const rol = data.roles.nombre_rol;
            if (rol === 'Administrador') window.location.href = 'panel_administrador.html';
            else if (rol === 'Jefe') window.location.href = 'panel_jefe.html';
            else window.location.href = 'panel_empleado.html';
        });
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Correo o contraseña incorrectos.'
        });
    }
    document.addEventListener('click', function (e) {
        if (e.target && e.target.id === 'toggle-password') {
            const passwordInput = document.getElementById('password');
            if (passwordInput) {
                const esPassword = passwordInput.getAttribute('type') === 'password';
                passwordInput.setAttribute('type', esPassword ? 'text' : 'password');
                e.target.textContent = esPassword ? '🙈' : '😮️';
            }
        }
    });
}

// Función para listar usuarios en el Panel Administrativo
async function listarUsuarios() {
    const client = getSupabase();
    if (!client) {
        setTimeout(listarUsuarios, 200);
        return;
    }

    const {data, error} = await client
        .from('personas')
        .select('id, nombre, apellido, cedula, email, cargo, roles(nombre_rol), password');

    const tbody = document.getElementById('cuerpo-tabla');
    if (tbody && data) {
        tbody.innerHTML = data.map(u => `
            <tr class="table-row">
                <td>${u.nombre} ${u.apellido}</td>
                <td>${u.cedula}</td>
                <td>${u.email}</td>
                <td>${u.cargo || 'N/A'}</td>
                <td><span class="badge ${u.roles.nombre_rol.toLowerCase()}">${u.roles.nombre_rol}</span></td>
                <td>
                    <div class="action-buttons">
                        <button onclick='abrirModalEditar(${JSON.stringify(u)})' class="btn-edit">✏️</button>
                        <button onclick="eliminarUsuario('${u.id}')" class="btn-delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

async function crearPersona() {
    const client = getSupabase();
    if (!client) return;

    // Capturamos los datos con los IDs correctos del nuevo modal
    const nombre = document.getElementById('new-name')?.value;
    const apellido = document.getElementById('new-lastname')?.value;
    const cedula = document.getElementById('new-cedula')?.value;
    const email = document.getElementById('new-email')?.value;
    const password = document.getElementById('new-password')?.value;
    const celular = document.getElementById('new-phone')?.value;
    const cargo = document.getElementById('new-cargo')?.value;
    const remuneracion = document.getElementById('new-salary')?.value; // Verifica que este ID exista en el HTML
    const rol_id = document.getElementById('new-role')?.value;
    const direccion = document.getElementById('new-address')?.value;

    // Validación de campos obligatorios para la Empresa "X"
    if (!nombre || !apellido || !cedula || !email || !password || !rol_id) {
        return Swal.fire('Campos Incompletos', 'Por favor, llene todos los campos marcados con (*)', 'warning');
    }

    const nuevaPersona = {
        nombre: nombre,
        apellido: apellido,
        cedula: cedula,
        email: email,
        password: password,
        celular: celular,
        cargo: cargo,
        remuneracion: parseFloat(remuneracion) || 0,
        rol_id: parseInt(rol_id),
        direccion: direccion
    };

    const {error} = await client.from('personas').insert([nuevaPersona]);

    if (error) {
        Swal.fire('Error de Registro', 'No se pudo guardar: ' + error.message, 'error');
    } else {
        await Swal.fire({
            icon: 'success',
            title: '¡Empleado Registrado!',
            text: 'El nuevo integrante ha sido añadido a la Empresa "X".',
            timer: 2000
        });
        cerrarModal();
        listarUsuarios(); // Refresca la tabla del dashboard
    }
}

async function solicitarPermiso() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const desde = document.getElementById('hora_desde').value;
    const hasta = document.getElementById('hora_hasta').value;


    const {error} = await supabaseClient
        .from('permisos')
        .insert([{
            empleado_id: user.id,
            fecha: document.getElementById('fecha_permiso').value,
            hora_desde: desde,
            hora_hasta: hasta,
            jefe_id: user.jefe_id
        }]);

    if (!error) alert("Solicitud enviada");
}


async function cargarSolicitudes(jefeId) {
    const {data, error} = await supabaseClient
        .from('permisos')
        .select('id, fecha, hora_desde, hora_hasta, personas(nombre, apellido)')
        .eq('jefe_id', jefeId)
        .eq('estado', 'Pendiente');

    const lista = document.getElementById('lista-permisos');
    lista.innerHTML = '';

    data.forEach(p => {
        lista.innerHTML += `
            <tr>
                <td>${p.personas.nombre} ${p.personas.apellido}</td>
                <td>${p.fecha}</td>
                <td>${p.hora_desde} - ${p.hora_hasta}</td>
                <td>
                    <button onclick="gestionarPermiso(${p.id}, 'Autorizado')" style="background:green; width:auto; padding:5px 10px;">Aprobar</button>
                    <button onclick="gestionarPermiso(${p.id}, 'Rechazado')" style="background:red; width:auto; padding:5px 10px;">X</button>
                </td>
            </tr>
        `;
    });
}

// Actualizar el estado del permiso
async function gestionarPermiso(idPermiso, nuevoEstado) {
    const {error} = await supabaseClient
        .from('permisos')
        .update({estado: nuevoEstado})
        .eq('id', idPermiso);

    if (!error) {
        alert("Estado actualizado: " + nuevoEstado);
        location.reload(); // Recargar para limpiar la lista
    }
}

async function actualizarDatos() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const nuevoCelular = document.getElementById('edit-celular').value;
    const nuevaDir = document.getElementById('edit-direccion').value;

    const {error} = await supabaseClient
        .from('personas')
        .update({celular: nuevoCelular, direccion: nuevaDir})
        .eq('id', user.id);

    if (!error) {
        Swal.fire('Éxito', 'Datos actualizados correctamente', 'success');
    }
}

// Función para registrar entrada o salida
async function registrarMarcacion(tipo) {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();

    if (!client) return;

    // Insertamos la marcación vinculada al ID del empleado
    const {error} = await client
        .from('asistencias')
        .insert([{
            empleado_id: user.id,
            tipo: tipo
            // fecha_hora se genera automáticamente en Supabase con DEFAULT NOW()
        }]);

    if (error) {
        Swal.fire('Error', 'No se pudo registrar la marcación: ' + error.message, 'error');
    } else {
        Swal.fire({
            icon: 'success',
            title: `Marcación de ${tipo} exitosa`,
            timer: 1500,
            showConfirmButton: false
        });
        cargarMisMarcaciones(user.id); // Refrescamos la tabla inmediatamente
    }
}

// Función para cargar el historial del empleado
async function cargarMisMarcaciones(empleadoId) {
    const client = getSupabase();
    const {data} = await client
        .from('asistencias')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('fecha_hora', {ascending: false});

    const tbody = document.getElementById('tabla-asistencias');
    if (tbody && data) {
        tbody.innerHTML = data.map(m => {
            const fecha = new Date(m.fecha_hora);
            return `
                <tr>
                    <td>${fecha.toLocaleDateString()}</td>
                    <td>${fecha.toLocaleTimeString()}</td>
                    <td><span class="badge ${m.tipo.toLowerCase()}">${m.tipo}</span></td>
                </tr>
            `;
        }).join('');
    }
}

// Función para cargar modales externos
async function cargarModal(nombreArchivo) {
    try {
        const respuesta = await fetch(`modales/${nombreArchivo}.html`);
        const html = await respuesta.text();

        // Creamos un contenedor temporal y lo inyectamos al body
        const contenedor = document.createElement('div');
        contenedor.id = "contenedor-modal";
        contenedor.innerHTML = html;
        document.body.appendChild(contenedor);
    } catch (error) {
        console.error("Error cargando el modal:", error);
    }
}

function cerrarModal() {
    const m = document.getElementById('contenedor-modal');
    if (m) m.remove();
}

async function enviarSolicitud() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const f = document.getElementById('fecha_permiso').value;
    const h1 = document.getElementById('hora_desde').value;
    const h2 = document.getElementById('hora_hasta').value;

    if (!f || !h1 || !h2) return Swal.fire('Error', 'Llene todos los campos', 'error');

    // Cálculo de diferencia (Lógica pura JS)
    const inicio = new Date(`2026-01-01T${h1}`);
    const fin = new Date(`2026-01-01T${h2}`);
    const diffMs = fin - inicio;

    if (diffMs <= 0) return Swal.fire('Error', 'La hora de fin debe ser mayor', 'error');

    const horasTotales = (diffMs / (1000 * 60 * 60)).toFixed(2);

    const client = getSupabase();
    const {error} = await client
        .from('permisos')
        .insert([{
            empleado_id: user.id,
            fecha: f,
            hora_desde: h1,
            hora_hasta: h2,
            total_horas: `${horasTotales} horas`,
            estado: 'Pendiente',
            jefe_id: user.jefe_id
        }]);

    if (!error) {
        Swal.fire('Éxito', 'Solicitud enviada correctamente', 'success');
        cerrarModal();
    }
}

async function verAuditoria() {
    // 1. Abrimos el modal primero
    await cargarModal('modal_auditoria');

    const client = getSupabase();
    // 2. Consultamos los últimos 50 movimientos
    const {data, error} = await client
        .from('auditoria')
        .select('*')
        .order('fecha_hora', {ascending: false})
        .limit(50);

    if (error) {
        console.error("Error al cargar auditoría:", error);
        return;
    }

    const tbody = document.getElementById('tabla-logs-auditoria');
    if (tbody) {
        tbody.innerHTML = data.map(log => `
            <tr>
                <td>${new Date(log.fecha_hora).toLocaleString()}</td>
                <td><strong>${log.tabla_afectada}</strong></td>
                <td><span class="badge ${log.accion.toLowerCase()}">${log.accion}</span></td>
                <td><pre style="font-size: 0.7rem; margin:0;">${JSON.stringify(log.detalles, null, 2)}</pre></td>
            </tr>
        `).join('');
    }
}

async function eliminarUsuario(id) {
    const confirmacion = await Swal.fire({
        title: '¿Confirmar eliminación?',
        text: "Se borrarán todos los registros vinculados (asistencias, permisos).",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        const client = getSupabase(); //
        const {error} = await client.from('personas').delete().eq('id', id); //

        if (error) {
            Swal.fire('Error', 'No se pudo eliminar: ' + error.message, 'error');
        } else {
            await Swal.fire('Eliminado', 'Registro borrado de la Empresa X.', 'success');
            listarUsuarios();
        }
    }
}

// --- FUNCIONES DEL DASHBOARD ADMINISTRADOR ---

// 1. Abrir el modal de creación
async function abrirModalCrear() {
    await cargarModal('modal_crear_empleado');
}

// 2. Buscador en Tiempo Real (Filtro de tabla)
function filtrarUsuarios() {
    const input = document.getElementById('buscador-usuarios');
    const filter = input.value.toLowerCase();
    const tbody = document.getElementById('cuerpo-tabla');
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        // Obtenemos el texto de las columnas Nombre, Cédula y Correo
        const nameCell = rows[i].getElementsByTagName('td')[0];
        const cedulaCell = rows[i].getElementsByTagName('td')[1];
        const emailCell = rows[i].getElementsByTagName('td')[2];

        if (nameCell || cedulaCell || emailCell) {
            const txtValue = (nameCell.textContent || nameCell.innerText) + ' ' +
                (cedulaCell.textContent || cedulaCell.innerText) + ' ' +
                (emailCell.textContent || emailCell.innerText);

            if (txtValue.toLowerCase().indexOf(filter) > -1) {
                rows[i].style.display = ""; // Muestra la fila
            } else {
                rows[i].style.display = "none"; // Oculta la fila
            }
        }
    }
}

function cerrarSesion() {
    sessionStorage.clear();
    Swal.fire({
        icon: 'info',
        title: 'Sesión Finalizada',
        text: 'Has salido del sistema de la Empresa "X" correctamente.',
        timer: 1500,
        showConfirmButton: false
    }).then(() => {
        window.location.href = 'index.html';
    });
}

function logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
    cerrarSesion();
}

document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'toggle-password') {
        const passwordInput = document.getElementById('password');
        const esOculto = passwordInput.getAttribute('type') === 'password';

        passwordInput.setAttribute('type', esOculto ? 'text' : 'password');
        e.target.textContent = esOculto ? '😮' : '🙈';
    }
});

async function abrirModalEditar(usuario) {
    await cargarModal('modal_crear_empleado');

    // Cambiamos el título del modal
    document.querySelector('.modal-header h3').innerText = "Editar Empleado";

    // Cambiamos el botón de guardar
    const btnGuardar = document.querySelector('.modal-footer .btn-primary');
    btnGuardar.innerText = "💾 Actualizar Datos";
    btnGuardar.onclick = () => actualizarPersona(usuario.id);

    // Llenamos los campos
    document.getElementById('new-name').value = usuario.nombre;
    document.getElementById('new-lastname').value = usuario.apellido;
    document.getElementById('new-cedula').value = usuario.cedula;
    document.getElementById('new-email').value = usuario.email;
    document.getElementById('new-password').value = usuario.password;
    document.getElementById('new-cargo').value = usuario.cargo || '';
    document.getElementById('new-role').value = (usuario.roles.nombre_rol === 'Administrador') ? 1 : (usuario.roles.nombre_rol === 'Empleado' ? 2 : 3);
}

async function actualizarPersona(id) {
    const client = getSupabase(); //

    const datos = {
        nombre: document.getElementById('new-name').value,
        apellido: document.getElementById('new-lastname').value,
        cedula: document.getElementById('new-cedula').value,
        email: document.getElementById('new-email').value,
        password: document.getElementById('new-password').value,
        cargo: document.getElementById('new-cargo').value,
        remuneracion: parseFloat(document.getElementById('new-salary').value) || 0,
        rol_id: parseInt(document.getElementById('new-role').value)
    };

    const {error} = await client.from('personas').update(datos).eq('id', id); //

    if (error) {
        Swal.fire('Error', 'No se pudo actualizar: ' + error.message, 'error');
    } else {
        await Swal.fire('¡Éxito!', 'Información actualizada correctamente.', 'success');
        cerrarModal(); // Cierra el modal tras el éxito
        listarUsuarios(); // Refresca la lista
    }
}

// 1. Cargar permisos pendientes para el Jefe
async function cargarPermisosJefe() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();

    // Traemos permisos cuyo jefe_id sea el del usuario logueado y estén 'Pendientes'
    const {data, error} = await client
        .from('permisos')
        .select(`
            id, 
            fecha, 
            hora_desde, 
            hora_hasta, 
            total_horas, 
            personas!empleado_id (nombre, apellido)
        `)
        .eq('jefe_id', user.id)
        .eq('estado', 'Pendiente');

    const tbody = document.getElementById('lista-permisos');
    if (!tbody) return;

    if (data && data.length > 0) {
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.personas.nombre} ${p.personas.apellido}</td>
                <td>${p.fecha}</td>
                <td>${p.hora_desde} - ${p.hora_hasta}</td>
                <td><strong>${p.total_horas}</strong></td>
                <td>
                    <div class="action-buttons">
                        <button onclick="responderPermiso('${p.id}', 'Aprobado')" class="btn-approve">✅</button>
                        <button onclick="responderPermiso('${p.id}', 'Rechazado')" class="btn-delete">❌</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay solicitudes pendientes</td></tr>';
    }
}

// 2. Función para Aprobar o Rechazar
async function responderPermiso(idPermiso, nuevoEstado) {
    const client = getSupabase();

    const {error} = await client
        .from('permisos')
        .update({estado: nuevoEstado})
        .eq('id', idPermiso);

    if (!error) {
        Swal.fire({
            title: `Solicitud ${nuevoEstado}`,
            icon: nuevoEstado === 'Aprobado' ? 'success' : 'info',
            timer: 1500,
            showConfirmButton: false
        });
        cargarPermisosJefe(); // Recargamos la lista
    } else {
        Swal.fire('Error', 'No se pudo procesar la solicitud', 'error');
    }
}

// --- FUNCIÓN DE MONITOREO PARA EL JEFE ---
async function cargarAsistenciasEquipo() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();

    // Consultamos asistencias de personas que tienen a este usuario como su jefe_id
    const {data, error} = await client
        .from('asistencias')
        .select(`
            tipo, 
            fecha_hora, 
            personas!empleado_id (nombre, apellido, jefe_id)
        `)
        .eq('personas.jefe_id', user.id) // Solo gente a mi cargo
        .order('fecha_hora', {ascending: false})
        .limit(10); // Solo las últimas 10 para no saturar

    const tbody = document.getElementById('lista-asistencias-equipo');
    if (!tbody) return;

    if (data && data.length > 0) {
        tbody.innerHTML = data.map(m => `
            <tr>
                <td>${m.personas.nombre} ${m.personas.apellido}</td>
                <td><span class="badge ${m.tipo.toLowerCase()}">${m.tipo}</span></td>
                <td>${new Date(m.fecha_hora).toLocaleString()}</td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Sin marcaciones recientes.</td></tr>';
    }
}