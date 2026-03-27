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
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('password-input').value;

    // Obtenemos el cliente usando nuestra nueva función segura
    const client = getSupabase();

    if (!client) {
        Swal.fire('Error', 'No se pudo inicializar la base de datos. Verifica tu conexión.', 'error');
        return;
    }

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
}

// Función para listar usuarios en el Panel Administrativo
async function listarUsuarios() {
    const client = getSupabase();
    // Traemos los datos incluyendo la relación con la tabla roles
    const {data, error} = await client
        .from('personas')
        .select('id, nombre, apellido, cedula, email, cargo, roles(nombre_rol)')
        .order('nombre', {ascending: true});

    if (error) {
        console.error("Error al obtener usuarios:", error);
        return;
    }

    const tbody = document.getElementById('cuerpo-tabla');
    if (!tbody) return;

    tbody.innerHTML = data.map(u => `
        <tr>
            <td>${u.nombre} ${u.apellido}</td>
            <td>${u.cedula}</td>
            <td>${u.email}</td>
            <td>${u.cargo || 'Sin asignar'}</td>
            <td><span class="badge">${u.roles?.nombre_rol || 'Usuario'}</span></td>
            <td>
                <button onclick="eliminarUsuario('${u.id}')" 
                        style="background:var(--admin-color); padding:5px 10px; font-size:11px; width:auto;">
                    Eliminar
                </button>
            </td>
        </tr>
    `).join('');
}

// Función para crear personas (Empresa X)
async function crearPersona() {
    const client = getSupabase();

    // Capturamos los datos del formulario
    const nuevaPersona = {
        nombre: document.getElementById('new-name').value,
        apellido: document.getElementById('new-lastname').value,
        cedula: document.getElementById('new-cedula').value,
        email: document.getElementById('new-email').value,
        password: document.getElementById('new-password').value,
        celular: document.getElementById('new-phone').value,
        cargo: document.getElementById('new-cargo').value,
        remuneracion: parseFloat(document.getElementById('new-salary').value) || 0,
        rol_id: parseInt(document.getElementById('new-role').value)
    };

    // Validación simple
    if (!nuevaPersona.nombre || !nuevaPersona.email || !nuevaPersona.cedula) {
        return Swal.fire('Error', 'Nombre, Cédula y Correo son obligatorios', 'error');
    }

    const {error} = await client.from('personas').insert([nuevaPersona]);

    if (error) {
        Swal.fire('Error de Registro', error.message, 'error');
    } else {
        Swal.fire('¡Éxito!', 'Empleado registrado en la Empresa X', 'success');
        listarUsuarios(); // Recargamos la tabla automáticamente
        // Limpiar campos
        document.querySelectorAll('.grid-form input').forEach(i => i.value = '');
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

function logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
}

async function registrarMarcacion(tipo) {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();

    // Bloquear botón para evitar doble clic
    const btn = event.target;
    btn.disabled = true;

    const {error} = await client.from('asistencias').insert([
        {empleado_id: user.id, tipo: tipo}
    ]);

    if (!error) {
        Swal.fire({
            title: `¡${tipo} Registrada!`,
            text: `Hora: ${new Date().toLocaleTimeString()}`,
            icon: 'success',
            timer: 2000
        });
        cargarMisMarcaciones(user.id);
    } else {
        Swal.fire('Error', 'No se pudo registrar', 'error');
    }
    btn.disabled = false;
}

async function cargarMisMarcaciones(empleadoId) {
    const {data} = await supabaseClient
        .from('asistencias')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('fecha_hora', {ascending: false});

    const tabla = document.getElementById('tabla-asistencias');
    tabla.innerHTML = '';
    data.forEach(m => {
        const dt = new Date(m.fecha_hora);
        tabla.innerHTML += `
            <tr>
                <td>${dt.toLocaleDateString()}</td>
                <td>${dt.toLocaleTimeString()}</td>
                <td>${m.tipo}</td>
            </tr>
        `;
    });
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
    const {data, error} = await client
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