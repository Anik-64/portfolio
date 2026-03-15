document.addEventListener('DOMContentLoaded', function() {
    const profilePic = document.getElementById('profilePic');
    const profilePicUpload = document.getElementById('profilePicUpload');
    const displayFullName = document.getElementById('displayFullName');
    const displayTagline = document.getElementById('displayTagline');
    const displayResume = document.getElementById('displayResume');
    const profileForm = document.getElementById('profileForm');
    
    // Contacts elements
    const contactsList = document.getElementById('contactsList');
    const addContactBtn = document.getElementById('addContactBtn');
    const contactModal = document.getElementById('contactModal');
    const closeContactModal = document.getElementById('closeContactModal');
    const cancelContact = document.getElementById('cancelContact');
    const contactForm = document.getElementById('contactForm');
    const contactTypeSelect = document.getElementById('contactType');
    const contactModalTitle = document.getElementById('contactModalTitle');

    // Delete elements
    const deleteModal = document.getElementById('deleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');

    const floatingMessage = document.getElementById('floatingMessage');

    let currentContactId = null;

    if (!localStorage.getItem('accessToken')) {
        window.location.href = '/login';
    }

    loadProfile();
    loadContacts();
    loadContactTypes();

    // --- Profile Picture Update ---
    profilePicUpload.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profilePic', file);

        try {
            const accessToken = localStorage.getItem('accessToken');
            const response = await fetch('/api/v1/upload/profile-pic', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: formData
            });
            const data = await response.json();
            if (data.error) {
                showMessage(data.message, 'error');
                return;
            }
            profilePic.src = data.profilepicurl;
            showMessage('Profile picture updated!', 'success');
            
            // Collect current form data to include with the new pic URL (to satisfy backend validation)
            const taglineStr = document.getElementById('tagline').value.trim();
            const taglineArray = taglineStr ? taglineStr.split(',').map(s => s.trim()).filter(s => s !== '') : [];

            const fullProfileData = {
                firstname: document.getElementById('firstName').value.trim(),
                lastname: document.getElementById('lastName').value.trim() || null,
                tagline: taglineArray,
                bio: document.getElementById('bio').value.trim() || null,
                resume_url: document.getElementById('resumeUrl').value.trim() || null,
                years_of_experience: parseInt(document.getElementById('experience').value) || 0,
                profilepicurl: data.profilepicurl
            };

            saveProfileData(fullProfileData, true);
        } catch (err) {
            console.error(err);
            showMessage('Upload failed', 'error');
        }
    });

    // --- Profile Info Update ---
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const taglineStr = document.getElementById('tagline').value.trim();
        const taglineArray = taglineStr ? taglineStr.split(',').map(s => s.trim()).filter(s => s !== '') : [];

        const formData = {
            firstname: document.getElementById('firstName').value.trim(),
            lastname: document.getElementById('lastName').value.trim() || null,
            tagline: taglineArray,
            bio: document.getElementById('bio').value.trim() || null,
            resume_url: document.getElementById('resumeUrl').value.trim() || null,
            years_of_experience: parseInt(document.getElementById('experience').value) || 0,
            profilepicurl: profilePic.src.startsWith('data:') ? null : profilePic.src // If it's a base64 from a previous failed load or placeholder, handle it
        };

        saveProfileData(formData);
    });

    // --- Contact Handlers ---
    addContactBtn.addEventListener('click', () => {
        currentContactId = null;
        contactModalTitle.textContent = 'Add Contact Info';
        contactForm.reset();
        contactModal.classList.remove('hidden');
    });

    closeContactModal.addEventListener('click', () => contactModal.classList.add('hidden'));
    cancelContact.addEventListener('click', () => contactModal.classList.add('hidden'));

    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = {
            contacttypeno: parseInt(document.getElementById('contactType').value),
            contact: document.getElementById('contactDetail').value.trim(),
            contactprefix: document.getElementById('contactPrefix').value.trim() || null,
            usenote: document.getElementById('contactNote').value.trim() || null
        };

        if (currentContactId) {
            updateContact(currentContactId, formData);
        } else {
            createContact(formData);
        }
    });

    cancelDelete.addEventListener('click', () => deleteModal.classList.add('hidden'));

    // --- API Functions ---

    async function fetchWithToken(url, options = {}) {
        const accessToken = localStorage.getItem('accessToken');
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        };

        const response = await fetch(url, options);
        if (response.status === 401) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                options.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
                return await fetch(url, options);
            } else {
                window.location.href = '/login';
                return null;
            }
        }
        return response;
    }

    async function refreshAccessToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;
        try {
            const res = await fetch('/api/v1/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            const data = await res.json();
            if (data.error) return false;
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            return true;
        } catch (e) { return false; }
    }

    async function loadProfile() {
        const response = await fetchWithToken('/api/v1/profile');
        if (!response) return;
        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        const profile = data.data;
        
        // Update UI
        displayFullName.textContent = `${profile.firstname} ${profile.lastname || ''}`;
        displayTagline.textContent = profile.tagline ? profile.tagline.join(', ') : 'No tagline set';
        if (profile.profilepicurl) profilePic.src = profile.profilepicurl;
        
        if (profile.resume_url) {
            displayResume.href = profile.resume_url;
            displayResume.classList.remove('hidden');
        } else {
            displayResume.classList.add('hidden');
        }

        // Fill Form
        document.getElementById('firstName').value = profile.firstname || '';
        document.getElementById('lastName').value = profile.lastname || '';
        document.getElementById('tagline').value = profile.tagline ? profile.tagline.join(', ') : '';
        document.getElementById('bio').value = profile.bio || '';
        document.getElementById('resumeUrl').value = profile.resume_url || '';
        document.getElementById('experience').value = profile.years_of_experience || 0;
    }

    async function saveProfileData(formData, isSilent = false) {
        const response = await fetchWithToken('/api/v1/profile', {
            method: 'PUT',
            body: JSON.stringify(formData)
        });
        if (!response) return;
        const data = await response.json();
        if (data.error) {
            if (!isSilent) showMessage(data.message, 'error');
            return;
        }
        if (!isSilent) {
            showMessage('Profile updated successfully!', 'success');
            loadProfile(); // Refresh UI
        }
    }

    async function loadContactTypes() {
        const response = await fetchWithToken('/api/v1/profile/contact-types');
        if (!response) return;
        const data = await response.json();
        if (data.error) return;
        
        contactTypeSelect.innerHTML = '<option value="">Select Type</option>';
        data.data.forEach(type => {
            const option = document.createElement('option');
            option.value = type.contacttypeno;
            option.textContent = type.contacttypetitle;
            contactTypeSelect.appendChild(option);
        });
    }

    async function loadContacts() {
        const response = await fetchWithToken('/api/v1/profile/contacts');
        if (!response) return;
        const data = await response.json();
        if (data.error) return;

        contactsList.innerHTML = '';
        if (data.data.length === 0) {
            contactsList.innerHTML = '<p class="text-xs text-gray-400 italic">No contacts added yet.</p>';
            return;
        }

        data.data.forEach(contact => {
            const div = document.createElement('div');
            div.className = 'group p-3 border rounded-lg hover:border-blue-300 transition-colors relative';
            
            let iconClass = 'fa-comment';
            const title = contact.contacttypetitle.toLowerCase();
            if (title.includes('phone') || title.includes('mobile')) iconClass = 'fa-phone';
            else if (title.includes('email')) iconClass = 'fa-envelope';
            else if (title.includes('github')) iconClass = 'fab fa-github';
            else if (title.includes('linkedin')) iconClass = 'fab fa-linkedin';
            else if (title.includes('twitter')) iconClass = 'fab fa-twitter';
            else if (title.includes('website')) iconClass = 'fa-globe';

            div.innerHTML = `
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mr-3">
                        <i class="fas ${iconClass} text-xs"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-gray-700">${contact.contacttypetitle} ${contact.usenote ? `<span class="text-[10px] font-normal text-gray-400">(${contact.usenote})</span>` : ''}</p>
                        <p class="text-sm text-gray-600">${contact.contactprefix ? contact.contactprefix + ' ' : ''}${contact.contact}</p>
                    </div>
                </div>
                <div class="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="edit-contact p-1 text-yellow-500 hover:bg-yellow-50 rounded" data-id="${contact.id}">
                        <i class="fas fa-edit text-[10px]"></i>
                    </button>
                    <button class="delete-contact p-1 text-red-500 hover:bg-red-50 rounded" data-id="${contact.id}">
                        <i class="fas fa-trash-alt text-[10px]"></i>
                    </button>
                </div>
            `;

            div.querySelector('.edit-contact').onclick = () => editContact(contact);
            div.querySelector('.delete-contact').onclick = () => confirmDeleteContact(contact.id);
            
            contactsList.appendChild(div);
        });
    }

    async function createContact(formData) {
        const response = await fetchWithToken('/api/v1/profile/contacts', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        if (!response) return;
        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        showMessage('Contact added!', 'success');
        contactModal.classList.add('hidden');
        loadContacts();
    }

    function editContact(contact) {
        currentContactId = contact.id;
        contactModalTitle.textContent = 'Edit Contact Info';
        document.getElementById('contactType').value = contact.contacttypeno;
        document.getElementById('contactDetail').value = contact.contact;
        document.getElementById('contactPrefix').value = contact.contactprefix || '';
        document.getElementById('contactNote').value = contact.usenote || '';
        contactModal.classList.remove('hidden');
    }

    async function updateContact(id, formData) {
        const response = await fetchWithToken(`/api/v1/profile/contacts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });
        if (!response) return;
        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        showMessage('Contact updated!', 'success');
        contactModal.classList.add('hidden');
        loadContacts();
    }

    function confirmDeleteContact(id) {
        currentContactId = id;
        deleteModal.classList.remove('hidden');
    }

    confirmDelete.onclick = async () => {
        const response = await fetchWithToken(`/api/v1/profile/contacts/${currentContactId}`, {
            method: 'DELETE'
        });
        if (!response) return;
        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        showMessage('Contact removed', 'success');
        deleteModal.classList.add('hidden');
        loadContacts();
    };

    function showMessage(message, type) {
        floatingMessage.textContent = message;
        floatingMessage.className = `floating-message ${type} show`;
        setTimeout(() => {
            floatingMessage.classList.remove('show');
            setTimeout(() => {
                floatingMessage.textContent = '';
                floatingMessage.className = 'floating-message';
            }, 300);
        }, 3000);
    }
});
