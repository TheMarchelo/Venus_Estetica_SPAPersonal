
// State
let loginModal;

// Shared Toasts
function showToastAuth(msg, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        const container = document.getElementById('toast-container');
        if (!container) return alert(msg);

        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
        toastEl.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
        container.appendChild(toastEl);
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Init Bootstrap Modals (Index only)
    const loginEl = document.getElementById('loginModal');
    if (loginEl) loginModal = new bootstrap.Modal(loginEl);

    // Auth Form
    const authForm = document.getElementById('auth-form');
    if (authForm) authForm.addEventListener('submit', handleAuthSubmit);

    // Profile Form
    const profileForm = document.getElementById('profile-form');
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);

    // Toggle Mode
    const toggleBtn = document.getElementById('toggle-auth-mode');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleAuthMode);
});

// Firebase Auth Listener
if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged(async (user) => {
        updateAuthUI(user);

        if (user) {
            // Fetch User Data for global usage
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                if (doc.exists) {
                    const data = doc.data();
                    const fullName = `${data.name} ${data.surname || ''}`.trim();

                    // Admin Navbar Button
                    const role = (data.role || '').toLowerCase();
                    const adminBtn = document.getElementById('nav-admin-item');
                    if (role === 'admin' || role === 'administrador') {
                        if (adminBtn) adminBtn.style.display = 'block';
                    } else {
                        if (adminBtn) adminBtn.style.display = 'none';
                    }

                    // 1. Profile Page Logic (The critical fix)
                    if (window.location.pathname.includes('profile.html')) {
                        loadProfileData(user, data);
                        loadUserHistory(user);
                    }

                    // 2. Prefill Index Appointment Form (Request from User)
                    const appName = document.getElementById('app-name');
                    const appPhone = document.getElementById('app-phone');

                    if (appName && !appName.value) appName.value = fullName;
                    if (appPhone && !appPhone.value) appPhone.value = data.phone || '';

                    // 3. Prefill Cart Order Form
                    const orderName = document.getElementById('order-name');
                    const orderPhone = document.getElementById('order-phone');
                    if (orderName && !orderName.value) orderName.value = fullName;
                    if (orderPhone && !orderPhone.value) orderPhone.value = data.phone || '';
                }
            } catch (e) {
                console.log("Error fetching user data for prefill:", e);
            }
        } else {
            if (window.location.pathname.includes('profile.html')) {
                window.location.href = 'index.html';
            }
        }
    });
}

function updateAuthUI(user) {
    const container = document.getElementById('nav-login-container');
    if (!container) return;

    if (user) {
        // FIXED: Link directly to profile.html instead of Modal
        container.innerHTML = `
            <a href="profile.html" class="btn btn-outline-gold btn-sm border-0">
                <i class="fas fa-user-circle fa-lg"></i>
            </a>
        `;
    } else {
        container.innerHTML = `
            <button class="btn btn-gold btn-sm" onclick="if(loginModal) loginModal.show()">Iniciar Sesión</button>
        `;
    }
}

function logout() {
    firebase.auth().signOut().then(() => {
        if (window.location.pathname.includes('profile.html')) {
            window.location.href = 'index.html';
        } else {
            location.reload();
        }
    });
}

// Toggle Login/Register
let isRegistering = false;
function toggleAuthMode(e) {
    e.preventDefault();
    isRegistering = !isRegistering;

    const title = document.getElementById('auth-title');
    const submit = document.getElementById('auth-submit');
    const toggle = document.getElementById('toggle-auth-mode');
    const registerFields = document.getElementById('register-fields');

    if (isRegistering) {
        title.textContent = "Registrarse";
        submit.textContent = "Registrarme";
        toggle.textContent = "¿Ya tienes cuenta? Inicia Sesión";
        if (registerFields) registerFields.style.display = 'block';

        document.getElementById('auth-name').required = true;
    } else {
        title.textContent = "Iniciar Sesión";
        submit.textContent = "Ingresar";
        toggle.textContent = "¿No tienes cuenta? Regístrate";
        if (registerFields) registerFields.style.display = 'none';

        document.getElementById('auth-name').required = false;
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    try {
        if (isRegistering) {
            const name = document.getElementById('auth-name').value;
            const surname = document.getElementById('auth-surname').value;
            const age = document.getElementById('auth-age').value;
            const phone = document.getElementById('auth-phone').value;
            const address = document.getElementById('auth-address').value;

            const userCred = await firebase.auth().createUserWithEmailAndPassword(email, password);

            await db.collection('users').doc(userCred.user.uid).set({
                email: email,
                name: name,
                surname: surname,
                age: age,
                phone: phone,
                address: address,
                role: 'client',
                createdAt: new Date()
            });

            await userCred.user.updateProfile({ displayName: name });
            showToastAuth('¡Registro exitoso!', 'success');
        } else {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            showToastAuth('Bienvenido de nuevo.', 'success');
        }
        if (loginModal) loginModal.hide();
        e.target.reset();
    } catch (error) {
        console.error(error);
        showToastAuth(error.message, 'danger');
    }
}

// Profile Page: Load Data
async function loadProfileData(user, preloadedData = null) {
    let data = preloadedData;
    if (!data) {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) data = doc.data();
    }

    if (data) {
        const dispName = document.getElementById('p-display-name');
        if (dispName) dispName.textContent = `${data.name} ${data.surname || ''}`;

        const roleBadge = document.getElementById('p-role-badge');
        if (roleBadge) roleBadge.textContent = (data.role || 'CLIENT').toUpperCase();

        const emailField = document.getElementById('p-email');
        if (emailField) emailField.value = user.email;

        const nameField = document.getElementById('p-name');
        if (nameField) nameField.value = data.name || '';

        const surnameField = document.getElementById('p-surname');
        if (surnameField) surnameField.value = data.surname || '';

        const ageField = document.getElementById('p-age');
        if (ageField) ageField.value = data.age || '';

        const phoneField = document.getElementById('p-phone');
        if (phoneField) phoneField.value = data.phone || '';

        const addressField = document.getElementById('p-address');
        if (addressField) addressField.value = data.address || '';
    }
}

// Profile Page: Update
async function handleProfileUpdate(e) {
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user) return;

    const data = {
        name: document.getElementById('p-name').value,
        surname: document.getElementById('p-surname').value,
        age: document.getElementById('p-age').value,
        phone: document.getElementById('p-phone').value,
        address: document.getElementById('p-address').value
    };

    try {
        await db.collection('users').doc(user.uid).update(data);
        showToastAuth('Perfil actualizado correctamente.');
        // Update display name immediately
        document.getElementById('p-display-name').textContent = `${data.name} ${data.surname}`;
    } catch (err) {
        showToastAuth('Error al actualizar.', 'danger');
    }
}

function getStatusBadge(status) {
    let color = 'secondary';
    const s = (status || '').toLowerCase();
    if (s.includes('pendiente')) color = 'warning text-dark';
    else if (s.includes('confirmad') || s.includes('enviado') || s.includes('completado') || s.includes('disponible')) color = 'success';
    else if (s.includes('cancelad') || s.includes('agotado')) color = 'danger';

    return `<span class="badge bg-${color}">${status || 'Pendiente'}</span>`;
}

// Profile Page: History
async function loadUserHistory(user) {
    const citasBody = document.getElementById('table-citas-body');
    const pedidosBody = document.getElementById('table-pedidos-body');

    if (citasBody) {
        citasBody.innerHTML = '<tr><td colspan="3" class="text-center">Cargando...</td></tr>';
        const allCitas = await db.collection('citas').where('userId', '==', user.uid).get();

        citasBody.innerHTML = '';
        if (allCitas.empty) {
            citasBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Sin historial de citas</td></tr>';
        } else {
            allCitas.forEach(doc => {
                const c = doc.data();
                citasBody.innerHTML += `
                    <tr>
                        <td>${c.date || 'N/A'}</td>
                        <td>${c.service}</td>
                        <td>${getStatusBadge(c.status)}</td>
                    </tr>`;
            });
        }
    }

    if (pedidosBody) {
        pedidosBody.innerHTML = '<tr><td colspan="3" class="text-center">Cargando...</td></tr>';
        const allPedidos = await db.collection('pedidos').where('userId', '==', user.uid).get();

        pedidosBody.innerHTML = '';
        if (allPedidos.empty) {
            pedidosBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Sin pedidos recientes</td></tr>';
        } else {
            allPedidos.forEach(doc => {
                const p = doc.data();
                const date = p.timestamp ? new Date(p.timestamp.seconds * 1000).toLocaleDateString() : 'N/A';
                const total = (p.total || 0).toLocaleString();
                pedidosBody.innerHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>₡${total}</td>
                        <td>${getStatusBadge(p.status)}</td>
                    </tr>`;
            });
        }
    }
}

// Grant Admin (Dev Tool)
async function grantAdminRole() {
    const user = firebase.auth().currentUser;
    if (user) {
        await db.collection('users').doc(user.uid).update({ role: 'admin' });
        alert("¡Ahora eres admin! Recarga la página.");
        location.reload();
    }
}
window.grantAdminRole = grantAdminRole;
window.getStatusBadge = getStatusBadge;
window.loadProfileData = loadProfileData;
window.loadUserHistory = loadUserHistory;
// Expose for debugging if needed
