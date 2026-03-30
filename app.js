const SB_URL = "https://vmorgejoxarkypgeavin.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtb3JnZWpveGFya3lwZ2VhdmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDAxODAsImV4cCI6MjA5MDExNjE4MH0.Snj2a7UVGvYhXfE8_1Rx-X91fupnPq-4A9fVMAj38jQ";

// ==================== VALIDACIONES ====================
function validarCamposPersona(datos) {
    const { nombre, apellido, cedula, email, password, rol_id } = datos;
    if (!nombre || !apellido || !cedula || !email || !password || !rol_id) {
        Swal.fire('Campos incompletos', 'Todos los campos marcados con * son obligatorios.', 'warning');
        return false;
    }
    const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    if (!emailRegex.test(email)) {
        Swal.fire('Email inválido', 'Por favor ingrese un correo electrónico válido.', 'error');
        return false;
    }
    const cedulaRegex = /^\d{10}$/;
    if (!cedulaRegex.test(cedula)) {
        Swal.fire('Cédula inválida', 'La cédula debe tener 10 dígitos numéricos.', 'error');
        return false;
    }
    if (datos.celular && !/^\d{7,10}$/.test(datos.celular)) {
        Swal.fire('Teléfono inválido', 'El teléfono debe contener solo números (7-10 dígitos).', 'error');
        return false;
    }
    return true;
}

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

    const {data, error} = await client
        .from('personas')
        .select('id, nombre, apellido, cedula, email, celular, direccion, cargo, roles(nombre_rol), password, activo, jefe_id')
        .order('nombre', {ascending: true});

    const tbody = document.getElementById('cuerpo-tabla');
    if (tbody && data) {
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No hay empleados registrados.</td></tr>';
        } else {
            tbody.innerHTML = data.map(u => {
                const estadoTexto = u.activo !== false ? 'Activo' : 'Inactivo';
                const estadoClase = u.activo !== false ? 'entrada' : 'delete';
                const telefono = u.celular || '—';
                const direccion = u.direccion || '—';
                return `
                <tr class="table-row">
                     <td>${u.nombre} ${u.apellido}</td>
                     <td>${u.cedula}</td>
                     <td>${u.email}</td>
                     <td>${telefono}</td>
                     <td>${direccion}</td>
                     <td>${u.cargo || 'N/A'}</td>
                     <td><span class="badge ${u.roles?.nombre_rol.toLowerCase()}">${u.roles?.nombre_rol}</span></td>
                     <td><span class="badge ${estadoClase}">${estadoTexto}</span></td>
                     <td>
                        <div class="action-buttons">
                            <button onclick='abrirModalEditar(${JSON.stringify(u)})' class="btn-edit" title="Editar usuario">✏️</button>
                            ${u.activo !== false
                                ? `<button onclick="inactivarUsuario('${u.id}')" class="btn-delete" title="Inactivar usuario">🚫</button>`
                                : `<button onclick="activarUsuario('${u.id}')" class="btn-activate" title="Reactivar usuario">✅</button>`
                            }
                        </div>
                     </td>
                </tr>
            `}).join('');
        }
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
    const valorJefe = document.getElementById('new-jefe').value;

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
        direccion: direccion,
        jefe_id: valorJefe ? valorJefe : null
    };

    if (!validarCamposPersona(datos)) return;
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

    const {data, error} = await client.from('asistencias').select('*')
        .eq('empleado_id', user.id).order('fecha_hora', {ascending: false});

    if (error) return;

    const tbody = document.getElementById('tabla-asistencias');
    if (tbody && data) {
        if (data.length > 0) {
            tbody.innerHTML = data.map(m => {
                // Formateamos la fecha a nuestro gusto
                const fechaObj = new Date(m.fecha_hora);
                const fechaLimpia = fechaObj.toLocaleString('es-EC', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                }).replace(',', ''); // Quitamos la coma automática

                return `
                <tr>
                    <td><span class="badge ${m.tipo.toLowerCase()}">${m.tipo}</span></td>
                    <td>${fechaLimpia}</td> </tr>
            `
            }).join('');
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
        await registrarAuditoria('asistencias', 'INSERT', {tipo: tipo});
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
        // Añadimos la hora actual a la URL para obligar al navegador a descargar la versión más reciente
        const timestamp = new Date().getTime();
        const respuesta = await fetch(`${nombreArchivo}.html?t=${timestamp}`);
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

    const {data: dataEmpleado} = await client
        .from('personas')
        .select('jefe_id')
        .eq('id', user.id)
        .single();

    const idJefe = (dataEmpleado && dataEmpleado.jefe_id) ? dataEmpleado.jefe_id : null;

    // Si el empleado es huérfano (no tiene jefe asignado por el admin), le bloqueamos el permiso
    if (!idJefe) {
        return Swal.fire('Sin asignación', 'Aún no tienes un Jefe de Área asignado en el sistema para aprobar esto. Contacta al Administrador.', 'warning');
    }

    // Si todo está bien, mandamos el permiso con el idJefe correcto
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
        await registrarAuditoria('permisos', 'INSERT', {fecha: f, horas: formatoIntervalo});
        cerrarModal();
        cargarMisPermisos();
    }
}

// --- FUNCIÓN PARA VER LA LISTA DE PERMISOS ---
async function cargarMisPermisos(desde = '', hasta = '') {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();

    let fechaInicio = desde;
    let fechaFin = hasta;

    // Si no mandan fecha, ponemos el día de HOY
    if (!fechaInicio) {
        const hoy = new Date();
        fechaInicio = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    }
    // Si llenó el "desde" pero no el "hasta", buscamos solo ese día específico
    if (!fechaFin) fechaFin = fechaInicio;

    const {data, error} = await client.from('permisos')
        .select('fecha, estado').eq('empleado_id', user.id)
        .gte('fecha', fechaInicio).lte('fecha', fechaFin).order('fecha', {ascending: false});

    const tbody = document.getElementById('lista-permisos-usuario');
    if (tbody && data) {
        if (data.length > 0) {
            tbody.innerHTML = data.map(p => {
                let badgeClass = p.estado === 'Aprobado' ? 'entrada' : (p.estado === 'Rechazado' ? 'delete' : 'update');
                return `<tr><td>${p.fecha}</td><td><span class="badge ${badgeClass}">${p.estado}</span></td></tr>`;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;">Sin permisos el ${fechaInicio}.</td></tr>`;
        }
    }
}

// Disparador del botón de buscar
function filtrarPermisosEmp() {
    const desde = document.getElementById('filtro-desde-emp').value;
    const hasta = document.getElementById('filtro-hasta-emp').value;
    cargarMisPermisos(desde, hasta);
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
async function abrirModalEditar(usuario) {
    await cargarModal('modal_crear_empleado');
    await cargarListaJefes();

    document.querySelector('.modal-header h3').innerText = "Editar Empleado";
    const btnGuardar = document.querySelector('.modal-footer .btn-primary');
    btnGuardar.innerText = "💾 Actualizar Datos";
    btnGuardar.onclick = () => actualizarPersona(usuario.id);

    // Rellenar todos los campos
    document.getElementById('new-name').value = usuario.nombre;
    document.getElementById('new-lastname').value = usuario.apellido;
    document.getElementById('new-cedula').value = usuario.cedula;
    document.getElementById('new-email').value = usuario.email;
    document.getElementById('new-password').value = usuario.password;
    document.getElementById('new-cargo').value = usuario.cargo || '';
    document.getElementById('new-phone').value = usuario.celular || '';
    document.getElementById('new-address').value = usuario.direccion || '';
    
    if (document.getElementById('new-salary')) {
        document.getElementById('new-salary').value = usuario.remuneracion || 0;
    }
    const rolSelect = document.getElementById('new-role');
    if (rolSelect && usuario.roles) {
        rolSelect.value = (usuario.roles.nombre_rol === 'Administrador') ? 1 : (usuario.roles.nombre_rol === 'Empleado' ? 2 : 3);
    }
    const selectJefe = document.getElementById('new-jefe');
    if (selectJefe) {
        selectJefe.value = usuario.jefe_id ? usuario.jefe_id : "";
    }
}

// 2. Buscador en Tiempo Real (Filtro de tabla)
function filtrarUsuarios() {
    const input = document.getElementById('buscador-usuarios');
    const filter = input.value.toLowerCase();
    const tbody = document.getElementById('cuerpo-tabla');
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td');
        if (cells.length >= 5) {
            const nombre = cells[0].textContent.toLowerCase();
            const cedula = cells[1].textContent.toLowerCase();
            const email = cells[2].textContent.toLowerCase();
            const telefono = cells[3].textContent.toLowerCase();
            const direccion = cells[4].textContent.toLowerCase();

            if (nombre.includes(filter) || cedula.includes(filter) || email.includes(filter) ||
                telefono.includes(filter) || direccion.includes(filter)) {
                rows[i].style.display = "";
            } else {
                rows[i].style.display = "none";
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

// Función para abrir el modal de creación de empleados
async function abrirModalCrear() {
    await cargarModal('modal_crear_empleado');
    // Cambiar título del modal y texto del botón
    const titulo = document.querySelector('.modal-header h3');
    if (titulo) titulo.innerText = "Registrar Nuevo Empleado";
    const btnGuardar = document.querySelector('.modal-footer .btn-primary');
    if (btnGuardar) {
        btnGuardar.innerText = "💾 Guardar";
        btnGuardar.onclick = () => crearPersona();
    }
    // Limpiar el formulario
    const form = document.getElementById('form-crear-usuario');
    if (form) form.reset();
    // Cargar la lista de jefes (para el select)
    await cargarListaJefes();
}

async function abrirModalEditar(usuario) {
    await cargarModal('modal_crear_empleado');
    await cargarListaJefes();

    document.querySelector('.modal-header h3').innerText = "Editar Empleado";
    const btnGuardar = document.querySelector('.modal-footer .btn-primary');
    btnGuardar.innerText = "💾 Actualizar Datos";
    btnGuardar.onclick = () => actualizarPersona(usuario.id);

    document.getElementById('new-name').value = usuario.nombre;
    document.getElementById('new-lastname').value = usuario.apellido;
    document.getElementById('new-cedula').value = usuario.cedula;
    document.getElementById('new-email').value = usuario.email;
    document.getElementById('new-password').value = usuario.password;
    document.getElementById('new-cargo').value = usuario.cargo || '';
    document.getElementById('new-role').value = (usuario.roles.nombre_rol === 'Administrador') ? 1 : (usuario.roles.nombre_rol === 'Empleado' ? 2 : 3);

    // NUEVO: Dejar seleccionado a su jefe actual
    if (usuario.jefe_id) {
        document.getElementById('new-jefe').value = usuario.jefe_id;
    } else {
        document.getElementById('new-jefe').value = "";
    }
}

async function actualizarPersona(id) {
    if (!validarCamposPersona(datos)) return;
    const client = getSupabase();
    const valorJefe = document.getElementById('new-jefe').value;
    const datos = {
        nombre: document.getElementById('new-name').value,
        apellido: document.getElementById('new-lastname').value,
        cedula: document.getElementById('new-cedula').value,
        email: document.getElementById('new-email').value,
        password: document.getElementById('new-password').value,
        cargo: document.getElementById('new-cargo').value,
        remuneracion: parseFloat(document.getElementById('new-salary').value) || 0,
        rol_id: parseInt(document.getElementById('new-role').value),
        jefe_id: valorJefe ? valorJefe : null
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
// --- FUNCIÓN PARA VER PERMISOS (CORREGIDA LA AMBIGÜEDAD DE LLAVES FORÁNEAS) ---
async function cargarPermisosJefe() {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();

    // Le decimos a Supabase que use explícitamente la llave foránea '!empleado_id'
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

    if (error) {
        console.error("❌ Error en permisos del jefe:", error.message);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #ef4444;">Error de BD: ${error.message}</td></tr>`;
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
                        <button onclick="responderPermiso('${p.id}', 'Aprobado')" class="btn-approve" title="Aprobar">✅</button>
                        <button onclick="responderPermiso('${p.id}', 'Rechazado')" class="btn-delete" title="Rechazar">❌</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 15px;">No hay solicitudes pendientes de tu equipo.</td></tr>';
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
// --- MONITOREO DEL JEFE (BUSCADOR COMBINADO Y SOLO HOY) ---
async function cargarAsistenciasEquipo(desde = '', hasta = '') {
    const user = JSON.parse(sessionStorage.getItem('usuario_logueado'));
    const client = getSupabase();
    if (!user) return;

    let fechaInicio = desde;
    let fechaFin = hasta;

    if (!fechaInicio) {
        const hoy = new Date();
        fechaInicio = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    }
    if (!fechaFin) fechaFin = fechaInicio;

    // Para la BD, la fechaFin debe incluir hasta las 23:59:59 para no perder los marcajes de la tarde
    const inicioReal = `${fechaInicio} 00:00:00`;
    const finReal = `${fechaFin} 23:59:59`;

    const {
        data,
        error
    } = await client.from('asistencias').select(`tipo, fecha_hora, personas!inner (nombre, apellido, jefe_id)`)
        .eq('personas.jefe_id', user.id).gte('fecha_hora', inicioReal).lte('fecha_hora', finReal).order('fecha_hora', {ascending: false});

    // Guardamos la data general en la ventana para poder filtrar por texto rápidamente
    window.asistenciasEquipoActual = data || [];
    renderizarAsistenciasJefe(); // Pintamos la tabla
}

// Función que dibuja y filtra por texto a la vez
function renderizarAsistenciasJefe() {
    const filtroNombre = (document.getElementById('filtro-nombre-jefe')?.value || '').toLowerCase();
    const tbody = document.getElementById('lista-asistencias-equipo');
    if (!tbody) return;

    // Cruzamos la data obtenida con lo que el jefe escribe
    const dataFiltrada = window.asistenciasEquipoActual.filter(m => {
        const nombreCompleto = `${m.personas.nombre} ${m.personas.apellido}`.toLowerCase();
        return nombreCompleto.includes(filtroNombre);
    });

    if (dataFiltrada.length > 0) {
        tbody.innerHTML = dataFiltrada.map(m => {
            const fechaObj = new Date(m.fecha_hora);
            const fechaLimpia = fechaObj.toLocaleString('es-EC', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(',', '');
            return `<tr>
                <td>${m.personas.nombre} ${m.personas.apellido}</td>
                <td><span class="badge ${m.tipo.toLowerCase()}">${m.tipo}</span></td>
                <td>${fechaLimpia}</td>
            </tr>`;
        }).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 15px;">No hay resultados con estos filtros.</td></tr>';
    }
}

// Disparadores
function filtrarFechasJefe() {
    const desde = document.getElementById('filtro-desde-jefe').value;
    const hasta = document.getElementById('filtro-hasta-jefe').value;
    cargarAsistenciasEquipo(desde, hasta);
}

function limpiarFiltrosJefe() {
    document.getElementById('filtro-nombre-jefe').value = '';
    document.getElementById('filtro-desde-jefe').value = '';
    document.getElementById('filtro-hasta-jefe').value = '';
    cargarAsistenciasEquipo(); // Vuelve a cargar "Solo Hoy"
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
                    hour12: false
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

// --- FUNCIÓN PARA LLENAR EL SELECT DE JEFES ---
async function cargarListaJefes() {
    const client = getSupabase();

    // Buscamos solo a los que tienen rol_id = 3 (Jefes) y que estén activos
    const {data, error} = await client
        .from('personas')
        .select('id, nombre, apellido')
        .eq('rol_id', 3)
        .eq('activo', true);

    const selectJefe = document.getElementById('new-jefe');
    if (selectJefe) {
        selectJefe.innerHTML = '<option value="">Ninguno / Sin Jefe</option>'; // Opción por defecto

        if (data && !error) {
            data.forEach(jefe => {
                selectJefe.innerHTML += `<option value="${jefe.id}">${jefe.nombre} ${jefe.apellido}</option>`;
            });
        }
    }
}
