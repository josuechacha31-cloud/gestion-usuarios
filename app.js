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
        .eq('activo', true)
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

    // Aseguramos pedir el campo 'activo'
    const {data, error} = await client
        .from('personas')
        .select('id, nombre, apellido, cedula, email, cargo, roles(nombre_rol), password, activo')
        .order('nombre', {ascending: true});

    const tbody = document.getElementById('cuerpo-tabla');
    if (tbody && data) {
        tbody.innerHTML = data.map(u => {
            // Manejamos el estado (por si hay registros antiguos sin el campo)
            const estadoTexto = u.activo !== false ? 'Activo' : 'Inactivo';
            const estadoClase = u.activo !== false ? 'entrada' : 'delete'; // Verde o Rojo

            return `
            <tr class="table-row">
                <td>${u.nombre} ${u.apellido}</td>
                <td>${u.cedula}</td>
                <td>${u.email}</td>
                <td>${u.cargo || 'N/A'}</td>
                <td><span class="badge ${u.roles?.nombre_rol.toLowerCase()}">${u.roles?.nombre_rol}</span></td>
                
                <td><span class="badge ${estadoClase}">${estadoTexto}</span></td>
                
                <td>
                    <div class="action-buttons">
                        <button onclick='abrirModalEditar(${JSON.stringify(u)})' class="btn-edit" title="Editar">✏️</button>
                        ${u.activo !== false
                ? `<button onclick="inactivarUsuario('${u.id}')" class="btn-delete" title="Inactivar">🚫</button>`
                : `<button onclick="activarUsuario('${u.id}')" class="btn-activate" title="Activar">✅</button>`
            }
                    </div>
                </td>
            </tr>
        `
        }).join('');
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
        cerrarModal();
        Swal.fire('Error de Registro', 'No se pudo guardar: ' + error.message, 'error');
    } else {
        cerrarModal();
        await Swal.fire({
            icon: 'success',
            title: '¡Empleado Registrado!',
            text: 'El nuevo integrante ha sido añadido.',
            timer: 2000
        });
        listarUsuarios();
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

// --- FUNCIÓN PARA LISTAR LAS MARCACIONES DEL EMPLEADO ---
async function listarAsistenciasEmpleado() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();

    const {data, error} = await client
        .from('asistencias')
        .select('*')
        .eq('empleado_id', user.id)
        .order('fecha_hora', {ascending: false});

    if (error) {
        console.error("Error al cargar marcaciones:", error.message);
        return;
    }

    const tbody = document.getElementById('tabla-asistencias');
    if (tbody && data) {
        if (data.length > 0) {
            tbody.innerHTML = data.map(m => `
                <tr>
                    <td><span class="badge ${m.tipo.toLowerCase()}">${m.tipo}</span></td>
                    <td>${m.fecha_hora}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 15px;">No tienes marcaciones aún.</td></tr>';
        }
    }
}

// Función para registrar entrada o salida
async function registrarMarcacion(tipo) {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();

    // Fabricamos la fecha y hora local exacta de Ecuador
    const now = new Date();
    const timestampLocal = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');

    const {error} = await client
        .from('asistencias')
        .insert([{
            empleado_id: user.id,
            tipo: tipo,
            fecha_hora: timestampLocal // Usamos la hora local fabricada
        }]);

    if (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudo registrar: ' + error.message, 'error');
    } else {
        Swal.fire('Éxito', `${tipo} registrada correctamente`, 'success');
        listarAsistenciasEmpleado(); // Refresca la tabla
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

// Función segura para cerrar cualquier modal
function cerrarModal() {
    const contenedorOscuro = document.getElementById('contenedor-modal');
    if (contenedorOscuro) {
        contenedorOscuro.remove();
    }
}

// --- FUNCIÓN PARA SOLICITAR PERMISOS  ---
async function enviarSolicitud() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const f = document.getElementById('fecha_permiso').value;
    const h1 = document.getElementById('hora_desde').value;
    const h2 = document.getElementById('hora_hasta').value;

    if (!f || !h1 || !h2) return Swal.fire('Atención', 'Llene todos los campos', 'warning');

    // Cálculo de diferencia de tiempo
    const inicio = new Date(`2026-01-01T${h1}`);
    const fin = new Date(`2026-01-01T${h2}`);
    const diffMs = fin - inicio;

    if (diffMs <= 0) return Swal.fire('Error', 'La hora de fin debe ser mayor a la de inicio', 'error');


    const horas = Math.floor(diffMs / (1000 * 60 * 60));
    const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const formatoIntervalo = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:00`;

    const client = getSupabase();
    const idJefe = user.jefe_id ? user.jefe_id : null;

    const {error} = await client
        .from('permisos')
        .insert([{
            empleado_id: user.id,
            fecha: f,
            hora_desde: h1,
            hora_hasta: h2,
            total_horas: formatoIntervalo,
            estado: 'Pendiente',
            jefe_id: idJefe
        }]);

    if (error) {
        console.error("❌ Error BD Permisos:", error);
        Swal.fire('Error de BD', error.message, 'error');
    } else {
        Swal.fire('Éxito', 'Solicitud enviada correctamente', 'success');
        cerrarModal();
        cargarMisPermisos();
    }
}

// --- FUNCIÓN PARA VER LA LISTA DE PERMISOS ---
async function cargarMisPermisos() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();

    const {data, error} = await client
        .from('permisos')
        .select('fecha, estado')
        .eq('empleado_id', user.id)
        .order('fecha', {ascending: false});

    const tbody = document.getElementById('lista-permisos-usuario');
    if (tbody && data) {
        if (data.length > 0) {
            tbody.innerHTML = data.map(p => {
                let badgeClass = p.estado === 'Aprobado' ? 'entrada' : (p.estado === 'Rechazado' ? 'delete' : 'update');
                return `
                    <tr>
                        <td>${p.fecha}</td>
                        <td><span class="badge ${badgeClass}">${p.estado}</span></td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 15px;">Sin permisos solicitados.</td></tr>';
        }
    }
}

async function inactivarUsuario(id) {
    const confirmacion = await Swal.fire({
        title: '¿Inactivar Usuario?',
        text: "El usuario ya no podrá acceder al sistema, pero se conservará su historial para auditoría.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#64748b',
        confirmButtonText: 'Sí, inactivar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        const client = getSupabase();
        // Cambiamos el estado a 'false' en lugar de borrar
        const {error} = await client
            .from('personas')
            .update({activo: false})
            .eq('id', id);

        if (error) {
            Swal.fire('Error', 'No se pudo inactivar: ' + error.message, 'error');
        } else {
            await registrarAuditoria('personas', 'UPDATE', {id_afectado: id, estado_nuevo: 'Inactivo'});
            await Swal.fire('Usuario Inactivado', 'El registro ahora es histórico.', 'success');
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
    const client = getSupabase();

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

    const {error} = await client.from('personas').update(datos).eq('id', id);

    if (error) {
        cerrarModal();
        Swal.fire('Error', 'No se pudo actualizar: ' + error.message, 'error');
    } else {
        cerrarModal();
        await registrarAuditoria('personas', 'UPDATE', datos);
        await Swal.fire('¡Éxito!', 'Información actualizada correctamente.', 'success');
        listarUsuarios(); // Ahora sí refresca la lista al instante
    }
}

// --- FUNCIÓN PARA VER PERMISOS (PANEL JEFE) ---
async function cargarPermisosJefe() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();

    // Usamos personas!inner para cruzar obligatoriamente los datos
    const {data, error} = await client
        .from('permisos')
        .select(`
            id, 
            fecha, 
            hora_desde, 
            hora_hasta, 
            total_horas, 
            personas!inner (nombre, apellido)
        `)
        .eq('jefe_id', user.id)
        .eq('estado', 'Pendiente');

    const tbody = document.getElementById('lista-permisos');
    if (!tbody) return;

    // Detector de errores
    if (error) {
        console.error("❌ Error en permisos del jefe:", error.message);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #ef4444;">Error de BD. Revisa la consola.</td></tr>`;
        return;
    }

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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay solicitudes pendientes de tu equipo.</td></tr>';
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

    if (!user) return;

    // Usamos personas!inner para forzar a Supabase a filtrar por el jefe_id
    const {data, error} = await client
        .from('asistencias')
        .select(`
            tipo, 
            fecha_hora, 
            personas!inner (nombre, apellido, jefe_id)
        `)
        .eq('personas.jefe_id', user.id) // Ahora este filtro sí funcionará
        .order('fecha_hora', {ascending: false})
        .limit(10);

    const tbody = document.getElementById('lista-asistencias-equipo');
    if (!tbody) return;

    // Si hay un error de base de datos, te lo muestra en la consola (F12)
    if (error) {
        console.error("❌ Error de Supabase al cargar marcaciones:", error.message);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: #ef4444;">Error de BD. Revisa la consola (F12).</td></tr>`;
        return;
    }

    // Dibujamos la tabla si hay datos
    if (data && data.length > 0) {
        tbody.innerHTML = data.map(m => `
            <tr>
                <td>${m.personas.nombre} ${m.personas.apellido}</td>
                <td><span class="badge ${m.tipo.toLowerCase()}">${m.tipo}</span></td>
                <td>${m.fecha_hora}</td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 15px;">Sin marcaciones recientes de tu equipo.</td></tr>';
    }
}

// --- 1. FUNCIÓN PARA LEER LOS LOGS (CON FECHAS Y TEXTOS EN ESPAÑOL) ---
async function verAuditoria() {
    await cargarModal('modal_auditoria');
    const client = getSupabase();

    const {data, error} = await client
        .from('auditoria')
        .select('*, personas(nombre, apellido)')
        .order('fecha_hora', {ascending: false})
        .limit(50);

    if (error) {
        console.error("Error detallado de Supabase:", error);
        Swal.fire('Error de Base de Datos', 'No se pudieron cargar los logs: ' + error.message, 'error');
        return;
    }

    const tbody = document.getElementById('tabla-logs-auditoria');
    if (tbody) {
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(log => {
                const responsable = log.personas ? `${log.personas.nombre} ${log.personas.apellido}` : 'Sistema / Desconocido';

                // 1. Limpiar y formatear la fecha a formato local (DD/MM/YYYY, HH:MM:SS)
                const fechaObj = new Date(log.fecha_hora);
                const fechaLimpia = fechaObj.toLocaleString('es-EC', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false // Cambia a true si prefieres formato AM/PM
                });

                // 2. Traducir la acción al español para la vista
                let accionEspanol = log.accion;
                if (log.accion === 'INSERT') accionEspanol = 'CREACIÓN';
                if (log.accion === 'UPDATE') accionEspanol = 'MODIFICACIÓN';
                if (log.accion === 'DELETE') accionEspanol = 'ELIMINACIÓN';

                return `
                <tr>
                    <td>${fechaLimpia}</td>
                    <td><strong>${responsable}</strong></td>
                    <td><strong>${log.tabla_afectada}</strong></td>
                    <td><span class="badge ${log.accion.toLowerCase()}">${accionEspanol}</span></td>
                    <td><pre>${JSON.stringify(log.detalles, null, 2)}</pre></td>
                </tr>
            `
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No hay registros de auditoría todavía.</td></tr>';
        }
    }
}

// --- 2. FUNCIÓN PARA GUARDAR LOS LOGS ---
async function registrarAuditoria(tabla, accion, detalles) {
    const client = getSupabase();
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));

    if (!user) return;

    // Hora exacta local
    const now = new Date();
    const timestampLocal = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');

    const {error} = await client.from('auditoria').insert([{
        usuario_id: user.id,
        tabla_afectada: tabla,
        accion: accion,
        detalles: detalles,
        fecha_hora: timestampLocal
    }]);

    // ¡NUEVO!: Si falla al guardar, te lo imprime en la consola (F12)
    if (error) {
        console.error("❌ Error al guardar en auditoría:", error.message);
    }
}

// --- FUNCIÓN PARA REACTIVAR USUARIOS ---
async function activarUsuario(id) {
    const confirmacion = await Swal.fire({
        title: '¿Reactivar Usuario?',
        text: "El usuario recuperará su acceso al sistema inmediatamente.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981', // Verde
        confirmButtonText: 'Sí, activar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        const client = getSupabase();

        // Cambiamos el estado de vuelta a 'true'
        const {error} = await client
            .from('personas')
            .update({activo: true})
            .eq('id', id);

        if (error) {
            Swal.fire('Error', 'No se pudo activar: ' + error.message, 'error');
        } else {
            await registrarAuditoria('personas', 'UPDATE', {id_afectado: id, estado_nuevo: 'Activo'});

            await Swal.fire('Usuario Activado', 'El usuario ya puede ingresar a la Empresa "X".', 'success');
            listarUsuarios();
        }
    }
}