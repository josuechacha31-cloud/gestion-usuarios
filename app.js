async function login() {
    const email = document.getElementById('email-input').value;
    const {data, error} = await supabaseClient
        .from('personas')
        .select('nombre, roles(nombre_rol)')
        .eq('email', email)
        .single();

    if (data) {
        // Guardamos los datos en la sesión del navegador
        const sesion = {
            nombre: data.nombre,
            rol: data.roles.nombre_rol
        };
        sessionStorage.setItem('usuario_logueado', JSON.stringify(sesion));

        // Redirección según el rol
        if (sesion.rol === 'Administrador') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'empleado.html';
        }
    } else {
        alert("Usuario no encontrado");
    }
}

function logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
}