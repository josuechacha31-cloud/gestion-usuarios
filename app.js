const SB_URL = "https://vmorgejoxarkypgeavin.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtb3JnZWpveGFya3lwZ2VhdmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDAxODAsImV4cCI6MjA5MDExNjE4MH0.Snj2a7UVGvYhXfE8_1Rx-X91fupnPq-4A9fVMAj38jQ";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

async function login() {
    const email = document.getElementById('email-input').value;

    const { data, error } = await supabaseClient
        .from('personas')
        .select('nombre, roles(nombre_rol)')
        .eq('email', email)
        .single();

    if (error || !data) {
        alert("Usuario no registrado en la base de datos.");
        return;
    }

    document.getElementById('login-box').classList.add('hidden');
    
    if (data.roles.nombre_rol === 'Administrador') {
        document.getElementById('dash-admin').classList.remove('hidden');
    } else {
        document.getElementById('dash-empleado').classList.remove('hidden');
    }
}
async function crearPersona() {
    const nombre = document.getElementById('new-name').value;
    const email = document.getElementById('new-email').value;
    const rol_id = document.getElementById('new-role').value;

    const { data, error } = await supabaseClient
        .from('personas')
        .insert([{ nombre, email, rol_id }]);

    if (error) {
        alert("Error al guardar: " + error.message);
    } else {
        alert("¡Persona registrada con éxito!");
        document.getElementById('new-name').value = '';
        document.getElementById('new-email').value = '';
    }
}
