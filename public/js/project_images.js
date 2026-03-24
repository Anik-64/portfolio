document.addEventListener('DOMContentLoaded', function() {
    const dataTable = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
    const addBtn = document.getElementById('addBtn');
    const dataModal = document.getElementById('dataModal');
    const deleteModal = document.getElementById('deleteModal');
    const closeModal = document.getElementById('closeModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    const dataForm = document.getElementById('dataForm');
    const modalTitle = document.getElementById('modalTitle');
    const floatingMessage = document.getElementById('floatingMessage');
    const searchInput = document.getElementById('searchInput');
    const projectSelect = document.getElementById('project_id');
    const imageFile = document.getElementById('image_file');
    const imageUrlInput = document.getElementById('image_url');
    const uploadProgressContainer = document.getElementById('uploadProgressContainer');
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const uploadStatus = document.getElementById('uploadStatus');

    let originalData = [];
    let currentId = null;

    if (!localStorage.getItem('accessToken')) {
        window.location.href = '/login';
    }

    loadProjects();
    loadData();


    addBtn.addEventListener('click', () => {
        currentId = null;
        modalTitle.textContent = 'Add Project Image';
        dataForm.reset();
        imageFile.value = '';
        uploadProgressContainer.classList.add('hidden');
        document.getElementById('display_order').value = 0;
        dataModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => dataModal.classList.add('hidden'));
    closeDeleteModal.addEventListener('click', () => deleteModal.classList.add('hidden'));
    cancelDelete.addEventListener('click', () => deleteModal.classList.add('hidden'));

    searchInput.addEventListener('input', debounce(() => {
        const query = searchInput.value.trim().toLowerCase();
        if (query) {
            const filtered = originalData.filter(item => 
                (item.caption || '').toLowerCase().includes(query)
            );
            renderData(filtered);
        } else {
            renderData(originalData);
        }
    }, 500));

    dataForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const saveBtn = dataForm.querySelector('button[type="submit"]');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

        try {
            // Upload image file first if one was selected
            if (imageFile.files.length > 0) {
                const uploadedUrl = await uploadImageFile(imageFile.files[0]);
                if (!uploadedUrl) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save';
                    return;
                }
                imageUrlInput.value = uploadedUrl;
            }

            const formData = {
                project_id: parseInt(projectSelect.value),
                image_url: imageUrlInput.value.trim(),
                caption: document.getElementById('caption').value.trim() || null,
                display_order: parseInt(document.getElementById('display_order').value) || 0
            };

            if (!formData.project_id || !formData.image_url) {
                showMessage('Project and Image URL are required', 'error');
                return;
            }

            if (currentId) {
                await updateData(currentId, formData);
            } else {
                await createData(formData);
            }
        } catch (err) {
            console.error(err);
            showMessage('Error during save', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    });

    async function uploadImageFile(file) {
        uploadProgressContainer.classList.remove('hidden');
        uploadProgressBar.style.width = '0%';
        uploadStatus.textContent = 'Uploading...';

        const formData = new FormData();
        formData.append('coverImage', file);

        const accessToken = localStorage.getItem('accessToken');

        try {
            const xhr = new XMLHttpRequest();
            const promise = new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percent = (e.loaded / e.total) * 100;
                        uploadProgressBar.style.width = percent + '%';
                    }
                });

                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response.data.url);
                        } else {
                            reject(new Error('Upload failed'));
                        }
                    }
                };
            });

            xhr.open('POST', '/api/v1/upload/book/cover', true);
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
            xhr.send(formData);

            const url = await promise;
            uploadStatus.textContent = 'Upload complete!';
            return url;
        } catch (err) {
            console.error('Upload error:', err);
            showMessage('Image upload failed', 'error');
            return null;
        } finally {
            setTimeout(() => {
                uploadProgressContainer.classList.add('hidden');
            }, 2000);
        }
    }

    confirmDelete.addEventListener('click', function() {
        if (currentId) deleteData(currentId);
    });

    async function fetchWithToken(url, options = {}) {
        const accessToken = localStorage.getItem('accessToken');
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        };

        try {
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
        } catch (err) {
            console.error('Fetch error:', err);
            showMessage('An error occurred. Please try again.', 'error');
            return null;
        }
    }

    async function refreshAccessToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;

        try {
            const response = await fetch('/api/v1/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            const data = await response.json();
            if (data.error) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                return false;
            }
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            return true;
        } catch (err) {
            console.error('Refresh token error:', err);
            return false;
        }
    }

    async function loadProjects() {
        const response = await fetchWithToken('/api/v1/settings/projects');
        if (!response) return;
        if(response.status === 404) return;
        
        const data = await response.json();
        if (data.error) return;

        data.data.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = `[${project.id}] ${project.title}`;
            projectSelect.appendChild(option);
        });
    }

    async function loadData() {
        const response = await fetchWithToken('/api/v1/settings/project-images');
        if (!response) return;

        if(response.status === 404) {
             renderData([]);
             return;
        }

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            renderData([]);
            return;
        }
        originalData = data.data;
        renderData(data.data);
    }

    function renderData(items) {
        dataTable.innerHTML = '';
        if (!items || items.length === 0) {
            const row = dataTable.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 6;
            cell.textContent = 'No project images found';
            cell.className = 'text-center py-4 text-black';
            return;
        }

        items.forEach((item, index) => {
            const row = dataTable.insertRow();

            const idCell = row.insertCell(0);
            idCell.textContent = index + 1;
            idCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black';
            
            const projCell = row.insertCell(1);
            projCell.textContent = `Project ${item.project_id}`;
            projCell.className = 'px-4 py-2 whitespace-nowrap text-sm font-medium text-black';
            
            const imgCell = row.insertCell(2);
            imgCell.innerHTML = `<a href="${item.image_url}" target="_blank" class="text-blue-500 hover:underline">View Image</a>`;
            imgCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';

            const capCell = row.insertCell(3);
            capCell.textContent = item.caption || '-';
            capCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';

            const ordCell = row.insertCell(4);
            ordCell.textContent = item.display_order;
            ordCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';

            const actionsCell = row.insertCell(5);
            actionsCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black text-right';

            const actionButtons = document.createElement('div');
            actionButtons.className = 'flex justify-end gap-2';
            
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.className = 'bg-yellow-500 hover:bg-yellow-600 text-white rounded px-2 py-1';
            editBtn.addEventListener('click', () => editDataItem(item.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.className = 'bg-red-500 hover:bg-red-600 text-white rounded px-2 py-1';
            deleteBtn.addEventListener('click', () => confirmDeleteData(item.id));

            actionButtons.appendChild(editBtn);
            actionButtons.appendChild(deleteBtn);
            actionsCell.appendChild(actionButtons);
        });
    }

    async function createData(postData) {
        const response = await fetchWithToken('/api/v1/settings/project-images', {
            method: 'POST',
            body: JSON.stringify(postData)
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message || data.error, 'error');
            return;
        }
        showMessage('Successfully added', 'success');
        dataModal.classList.add('hidden');
        loadData();
    }

    async function editDataItem(id) {
        const response = await fetchWithToken(`/api/v1/settings/project-images/${id}`);
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        const itemData = data.data;
        currentId = id;
        modalTitle.textContent = 'Edit Project Image';
        
        projectSelect.value = itemData.project_id || '';
        imageUrlInput.value = itemData.image_url || '';
        document.getElementById('caption').value = itemData.caption || '';
        document.getElementById('display_order').value = itemData.display_order || 0;

        imageFile.value = ''; // Reset file input
        uploadProgressContainer.classList.add('hidden');
        dataModal.classList.remove('hidden');
    }

    async function updateData(id, putData) {
        const response = await fetchWithToken(`/api/v1/settings/project-images/${id}`, {
            method: 'PUT',
            body: JSON.stringify(putData)
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message || data.error, 'error');
            return;
        }
        showMessage('Successfully updated', 'success');
        dataModal.classList.add('hidden');
        loadData();
    }

    function confirmDeleteData(id) {
        currentId = id;
        deleteModal.classList.remove('hidden');
    }

    async function deleteData(id) {
        const response = await fetchWithToken(`/api/v1/settings/project-images/${id}`, {
            method: 'DELETE'
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        showMessage('Successfully deleted', 'success');
        deleteModal.classList.add('hidden');
        loadData();
    }

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

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});
