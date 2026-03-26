const SB_URL = "https://vmorgejoxarkypgeavin.supabase.co"; // Tu URL de la captura
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtb3JnZWpveGFya3lwZ2VhdmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDAxODAsImV4cCI6MjA5MDExNjE4MH0.Snj2a7UVGvYhXfE8_1Rx-X91fupnPq-4A9fVMAj38jQ"; // La llave que empieza con ey...
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

async function login() {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('password-input').value; // Nuevo input

    const {data, error} = await supabaseClient
        .from('personas')
        .select('*, roles(nombre_rol)')
        .eq('email', email)
        .eq('password', pass)
        .single();

    if (data) {
        sessionStorage.setItem('usuario_logueado', JSON.stringify(data));

        // Redirección dinámica según nombre_rol
        const rol = data.roles.nombre_rol;
        if (rol === 'Administrador') window.location.href = 'panel_administrador.html';
        else if (rol === 'Jefe') window.location.href = 'panel_jefe.html';
        else window.location.href = 'panel_empleado.html';
    } else {
        alert("Credenciales incorrectas");
    }
}

async function crearPersona() {
    const persona = {
        nombre: document.getElementById('new-name').value,
        apellido: document.getElementById('new-lastname').value,
        cedula: document.getElementById('new-cedula').value,
        email: document.getElementById('new-email').value,
        password: document.getElementById('new-password').value,
        celular: document.getElementById('new-phone').value,
        cargo: document.getElementById('new-cargo').value,
        remuneracion: parseFloat(document.getElementById('new-salary').value),
        rol_id: parseInt(document.getElementById('new-role').value)
    };

    const {data, error} = await supabaseClient
        .from('personas')
        .insert([persona]);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("¡Empleado registrado exitosamente!");
        // Limpiar formulario y recargar tabla
        location.reload();
    }
}

async function solicitarPermiso() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const desde = document.getElementById('hora_desde').value;
    const hasta = document.getElementById('hora_hasta').value;

    // Supabase/Postgres calcula el INTERVAL automáticamente al insertar
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

// Cargar permisos dirigidos a este jefe
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
    const {error} = await supabaseClient
        .from('asistencias')
        .insert([{empleado_id: user.id, tipo: tipo}]);

    if (!error) {
        alert("Marcación de " + tipo + " registrada");
        cargarMisMarcaciones(user.id);
    }
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