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