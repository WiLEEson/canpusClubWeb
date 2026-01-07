// === Azure Logic App endpoints & storage account ===
const IUPS = "https://prod-07.francecentral.logic.azure.com:443/workflows/9fdc376ae027445ea1d1713192055aa1/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=xDy9QcQTeorIZBQm0TCRoKR6tDnuIfnwU7rA89qtknc";
const RAI = "https://prod-14.francecentral.logic.azure.com:443/workflows/14b8366ba34c4bb085545e017561a26e/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=8TS6vOsrqWUHipTByJHWTYjEBY9KQz_Ln3J1H_9QPws";
const DELETE_MEDIA = "https://prod-29.francecentral.logic.azure.com:443/workflows/a5c8b2de51b24fb1915cf334d15babe1/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=j14LLZ_9yQ5aRpiMKZzyCt0VUIRCFSJbvB5Rm-UpVsM"; 
const MODIFY_MEDIA = "https://prod-04.francecentral.logic.azure.com:443/workflows/e83b0468509847adb41027935832fd43/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=f2oVKsdMYo1kquqJVbnivZnLda-q3cQMZ5Rwe58KYlc";
const BLOB_ACCOUNT = "https://blobstorageweek60.blob.core.windows.net";

// === jQuery handlers（确保DOM加载完成后执行） ===
$(document).ready(function () {
    // 核心按钮绑定
    $("#retImages").click(getImages);
    $("#subNewForm").click(submitNewAsset);
    $("#searchBtn").click(filterImages);
    $("#adminLoginBtn").click(adminLogin);
    $("#adminLogoutBtn").click(adminLogout);

    // 回车键触发搜索
    $("#searchInput").keypress((e) => {
        if (e.key === "Enter") filterImages();
    });

    // 页面加载时检查管理员登录状态
    checkAdminLoginStatus();

    // 页面加载后自动刷新活动列表
    getImages();

    // 点击活动卡片打开详情模态框
    $(document).on('click', '.media-card', function() {
        const detailData = JSON.parse($(this).attr('data-detail'));
        // 填充详情数据（含活动时间）
        $('#detailFileName').text(detailData.fileName || "(unnamed)");
        $('#detailUploader').text(detailData.uploader || "(unknown)");
        $('#detailActivity').text(detailData.activity || "(No Activity)");
        $('#detailClub').text(detailData.club || "(No Club)");
        $('#detailUserID').text(detailData.userID || "(unknown)");
        $('#detailDesc').text(detailData.desc || "No description");
        $('#detailFileLink').attr('href', detailData.fileLink || "#").attr('target', '_blank');
        // 显示详情模态框
        const detailModal = new bootstrap.Modal(document.getElementById('activityDetailModal'));
        detailModal.show();
    });

    // 删除按钮点击事件（事件委托，适配动态卡片）
    $(document).on('click', '.delete-btn', function(e) {
        e.stopPropagation(); // 阻断冒泡，避免打开详情
        e.preventDefault();
        const $card = $(this).closest('.media-card');
        const docId = $card.data('id');
        const deleteUrl = `${DELETE_MEDIA}&id=${encodeURIComponent(docId)}`;

        // 二次确认
        if (!confirm("Are you sure to delete this media? It cannot be recovered!")) {
            return;
        }

        // 调用删除接口
        $.ajax({
            url: deleteUrl,
            type: "DELETE",
            success: (response) => {
                console.log("Delete response:", response);
                alert("Media deleted successfully!");
                getImages(); // 刷新列表
            },
            error: (xhr, status, err) => {
                console.error("Delete failed:", status, err, xhr?.responseText);
                alert(`Delete failed: ${status} - ${err}`);
            }
        });
    });

    // Edit按钮点击事件（核心修复：填充隐藏字段+阻断冒泡）
    $(document).on('click', '.edit-btn', function(e) {
        e.stopPropagation(); // 关键：防止事件冒泡到卡片
        e.preventDefault();

        const $card = $(this).closest('.media-card');
        const docId = $card.data('id');
        const detailData = JSON.parse($card.attr('data-detail'));

        // 填充修改模态框（含隐藏字段，传递Logic App必需值）
        $('#editDocId').val(docId); // 文档ID
        $('#editUserName').val(detailData.uploader || ''); // 用户名（对应Logic App的userName）
        $('#editFileName').val(detailData.fileName || ''); // 文件名（对应Logic App的fileName）
        // 可修改字段填充原始值
        $('#editActivityName').val(detailData.activity || '');
        $('#editClubName').val(detailData.club || '');
        $('#editUserID').val(detailData.userID || '');
        $('#editActivityDescription').val(detailData.desc || '');

        // 打开修改模态框
        const editModal = new bootstrap.Modal(document.getElementById('activityEditModal'));
        editModal.show();
    });

    // 提交修改按钮绑定（必须在ready内部，确保DOM加载完成）
    $('#submitEditBtn').click(submitModifyAsset);
});

// === 管理员登录/退出函数 ===
function adminLogin() {
    const username = $("#adminUsername").val().trim();
    const password = $("#adminPassword").val().trim();
    const $error = $("#loginError");
    const validAdmin = { username: "admin", password: "admin123" };

    if (username === validAdmin.username && password === validAdmin.password) {
        localStorage.setItem("isAdminLoggedIn", "true");
        $("#adminLoginSection").hide();
        $("#uploadSection").show();
        $error.text("");
        alert("Admin login successful! You can now upload media.");
        getImages(); // 刷新列表显示编辑/删除键
    } else {
        $error.text("Invalid username or password. Only admins can upload.");
    }
}

function adminLogout() {
    const isConfirm = confirm("Are you sure you want to logout? All unsaved changes will be lost.");
    if (!isConfirm) return;

    localStorage.removeItem("isAdminLoggedIn");
    $("#uploadSection").hide();
    $("#adminLoginSection").show();
    // 清空登录表单
    $("#adminUsername").val("");
    $("#adminPassword").val("");
    $("#loginError").text("");

    getImages(); // 刷新列表隐藏编辑/删除键
    alert("Admin logout successful.");
}

function checkAdminLoginStatus() {
    const isLoggedIn = localStorage.getItem("isAdminLoggedIn") === "true";
    if (isLoggedIn) {
        $("#adminLoginSection").hide();
        $("#uploadSection").show();
    } else {
        $("#adminLoginSection").show();
        $("#uploadSection").hide();
    }
}

// === 上传新活动（管理员专属） ===
function submitNewAsset() {
    const isAdminLoggedIn = localStorage.getItem("isAdminLoggedIn") === "true";
    if (!isAdminLoggedIn) {
        alert("Permission denied! Only admins can upload media.");
        return;
    }

    // 收集上传数据
    const submitData = new FormData();
    submitData.append("FileName", $("#FileName").val().trim() || "");
    submitData.append("userID", $("#userID").val().trim() || "");
    submitData.append("userName", $("#userName").val().trim() || "");
    submitData.append("File", $("#UpFile")[0].files[0]); // 上传文件
    submitData.append("activityName", $("#activityName").val().trim() || "");
    submitData.append("clubName", $("#clubName").val().trim() || "");
    submitData.append("activityDescription", $("#activityDescription").val().trim() || "");

    // 调用上传接口
    $.ajax({
        url: IUPS,
        data: submitData,
        cache: false,
        enctype: "multipart/form-data",
        contentType: false,
        processData: false,
        type: "POST",
        success: (data) => {
            console.log("Upload response:", data);
            alert("Upload successful!");
            $("#newAssetForm")[0].reset(); // 清空表单
            getImages(); // 刷新列表
        },
        error: (xhr, status, err) => {
            console.error("Upload failed:", status, err, xhr?.responseText);
            alert("Upload failed — see console for details.");
        },
    });
}

// === 获取所有活动列表 ===
function getImages() {
    const $list = $("#ImageList");
    $list.addClass("media-grid").html('<div class="spinner-border" role="status"><span>Loading...</span></div>');
    const isAdminLoggedIn = localStorage.getItem("isAdminLoggedIn") === "true";

    // 调用获取列表接口
    $.ajax({
        url: RAI,
        type: "GET",
        dataType: "json",
        success: function (data) {
            console.log("Raw data received (all):", data);
            if (!Array.isArray(data)) {
                $list.html("<p>Invalid data format from server.</p>");
                return;
            }
            if (data.length === 0) {
                $list.html("<p>No media files found in the system.</p>");
                return;
            }

            let videoCounter = 0;
            const cards = [];
            $.each(data, function (_, val) {
                try {
                    // 提取并解码字段（兼容Base64编码）
                    let fileName = unwrapMaybeBase64(val.fileName || val.FileName || "");
                    let filePath = unwrapMaybeBase64(val.filePath || val.FilePath || "");
                    let userName = unwrapMaybeBase64(val.userName || val.UserName || "");
                    let userID = unwrapMaybeBase64(val.userID || val.UserID || "");
                    let activityName = unwrapMaybeBase64(val.activityName || val.ActivityName || "");
                    let clubName = unwrapMaybeBase64(val.clubName || val.ClubName || "");
                    let docId = val.id || val.Id || "";
                    const contentType = val.contentType || val.ContentType || "";
                    const fullUrl = buildBlobUrl(filePath);
                    const isVideo = isLikelyVideo({ contentType, url: fullUrl, fileName });

                    // 构建卡片详情数据（含Logic App必需字段）
                    const detailData = JSON.stringify({
                        fileName: fileName,
                        uploader: userName, // 对应userName
                        activity: activityName,
                        club: clubName,
                        userID: userID, // 活动时间
                        desc: unwrapMaybeBase64(val.activityDescription || val.ActivityDescription || "No description"),
                        fileLink: fullUrl
                    });

                    // 构建视频卡片
                    if (isVideo) {
                        videoCounter += 1;
                        const label = `video${videoCounter}`;
                        cards.push(`
                            <div class="media-card" 
                                 data-id="${escapeHtml(docId)}"
                                 data-filepath="${escapeHtml(filePath)}"  
                                 data-detail="${escapeHtml(detailData)}">  
                                <div class="media-thumb">
                                    <a class="video-link" href="${fullUrl}" target="_blank" download="${fileName || label}">${label}</a>
                                </div>
                                <div class="media-body">
                                    <span class="media-title">Activity: ${escapeHtml(activityName || "(No Activity)")}</span>
                                    <div style="color:#6b7280;">Club: ${escapeHtml(clubName || "(No Club)")}</div>
                                    <div>Time of Activity: ${escapeHtml(userID || "(unknown)")}</div>
                                    <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} </div>
                                    <div style="color:#6b7280; margin-top:4px;">${escapeHtml(fileName || "(unnamed)")}</div>
                                    ${isAdminLoggedIn ? `
                                        <button class="btn btn-primary btn-sm edit-btn me-2" style="margin-top:8px;">
                                            Edit
                                        </button>
                                        <button class="btn btn-danger btn-sm delete-btn" style="margin-top:8px;">
                                            Delete
                                        </button>
                                    ` : ""}
                                </div>
                            </div>
                        `);
                    } 
                    // 构建图片卡片
                    else {
                        const safeLabel = escapeHtml(fileName || fullUrl);
                        cards.push(`
                            <div class="media-card" 
                                 data-id="${escapeHtml(docId)}" 
                                 data-filepath="${escapeHtml(filePath)}"
                                 data-detail="${escapeHtml(detailData)}">
                                <div class="media-thumb">
                                    <img src="${fullUrl}"
                                         alt="${safeLabel}"
                                         onerror="imageFallbackToLink(this, '${fullUrl.replace(/'/g,"\\'")}', '${safeLabel.replace(/'/g,"\\'")}')" />
                                </div>
                                <div class="media-body">
                                    <span class="media-title">Activity: ${escapeHtml(activityName || "(No Activity)")}</span>
                                    <div style="color:#6b7280;">Club: ${escapeHtml(clubName || "(No Club)")}</div>
                                    <div>Time of Activity: ${escapeHtml(userID || "(unknown)")} </div>
                                    <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} </div>
                                    <div style="color:#6b7280; margin-top:4px;">${safeLabel}</div>
                                    <div class="image-error"></div>
                                    ${isAdminLoggedIn ? `
                                        <button class="btn btn-primary btn-sm edit-btn me-2" style="margin-top:8px;">
                                            Edit
                                        </button>
                                        <button class="btn btn-danger btn-sm delete-btn" style="margin-top:8px;">
                                            Delete
                                        </button>
                                    ` : ""}
                                </div>
                            </div>
                        `);
                    }
                } catch (err) {
                    console.error("Error building card:", err, val);
                    cards.push(`
                        <div class="media-card">
                            <div class="media-body">
                                <span class="media-title" style="color:#b91c1c;">Failed to load item</span>
                            </div>
                        </div>
                    `);
                }
            });
            $list.html(cards.join(""));
        },
        error: (xhr, status, error) => {
            console.error("Error fetching media (all):", status, error, xhr?.responseText);
            $list.html("<p style='color:red;'>Error loading media. Check console.</p>");
        },
    });
}

// === 按活动/俱乐部搜索 ===
function filterImages() {
    const $list = $("#ImageList");
    $list.addClass("media-grid").html('<div class="spinner-border" role="status"><span>Loading...</span></div>');
    const searchTerm = $("#searchInput").val().trim().toLowerCase();
    const isAdminLoggedIn = localStorage.getItem("isAdminLoggedIn") === "true";

    // 调用获取列表接口（筛选逻辑在前端）
    $.ajax({
        url: RAI,
        type: "GET",
        dataType: "json",
        success: function (data) {
            console.log("Raw data received (filter):", data);
            if (!Array.isArray(data)) {
                $list.html("<p>Invalid data format from server.</p>");
                return;
            }
            if (data.length === 0) {
                $list.html("<p>No media files found in the system.</p>");
                return;
            }

            let videoCounter = 0;
            const cards = [];
            $.each(data, function (_, val) {
                try {
                    // 提取并解码字段
                    let fileName = unwrapMaybeBase64(val.fileName || val.FileName || "");
                    let filePath = unwrapMaybeBase64(val.filePath || val.FilePath || "");
                    let userName = unwrapMaybeBase64(val.userName || val.UserName || "");
                    let userID = unwrapMaybeBase64(val.userID || val.UserID || "");
                    let activityName = unwrapMaybeBase64(val.activityName || val.ActivityName || "").toLowerCase();
                    let clubName = unwrapMaybeBase64(val.clubName || val.ClubName || "").toLowerCase();
                    let docId = unwrapMaybeBase64(val.id || val.Id || "");
                    const contentType = val.contentType || val.ContentType || "";
                    const fullUrl = buildBlobUrl(filePath);
                    const isVideo = isLikelyVideo({ contentType, url: fullUrl, fileName });

                    // 筛选逻辑：匹配活动名或俱乐部名
                    if (searchTerm) {
                        const isMatch = activityName.includes(searchTerm) || clubName.includes(searchTerm);
                        if (!isMatch) return true; // 不匹配则跳过当前项
                    }

                    // 显示用的原始字段（未转小写）
                    const displayActivity = unwrapMaybeBase64(val.activityName || val.ActivityName || "");
                    const displayClub = unwrapMaybeBase64(val.clubName || val.ClubName || "");

                    // 构建卡片详情数据
                    const detailData = JSON.stringify({
                        fileName: fileName,
                        uploader: userName,
                        activity: displayActivity,
                        club: displayClub,
                        userID: userID,
                        desc: unwrapMaybeBase64(val.activityDescription || val.ActivityDescription || "No description"),
                        fileLink: fullUrl
                    });

                    // 构建视频卡片
                    if (isVideo) {
                        videoCounter += 1;
                        const label = `video${videoCounter}`;
                        cards.push(`
                            <div class="media-card" 
                                 data-id="${escapeHtml(docId)}" 
                                 data-filepath="${escapeHtml(filePath)}"
                                 data-detail="${escapeHtml(detailData)}">
                                <div class="media-thumb">
                                    <a class="video-link" href="${fullUrl}" target="_blank" download="${fileName || label}">${label}</a>
                                </div>
                                <div class="media-body">
                                    <span class="media-title">Activity: ${escapeHtml(displayActivity || "(No Activity)")}</span>
                                    <div style="color:#6b7280;">Club: ${escapeHtml(displayClub || "(No Club)")}</div>
                                    <div>Time of Activity: ${escapeHtml(userID || "(unknown)")}</div>
                                    <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} </div>
                                    <div style="color:#6b7280; margin-top:4px;">${escapeHtml(fileName || "(unnamed)")}</div>
                                    ${isAdminLoggedIn ? `
                                        <button class="btn btn-primary btn-sm edit-btn me-2" style="margin-top:8px;">
                                            Edit
                                        </button>
                                        <button class="btn btn-danger btn-sm delete-btn" style="margin-top:8px;">
                                            Delete
                                        </button>
                                    ` : ""}
                                </div>
                            </div>
                        `);
                    } 
                    // 构建图片卡片
                    else {
                        const safeLabel = escapeHtml(fileName || fullUrl);
                        cards.push(`
                            <div class="media-card" 
                                 data-id="${escapeHtml(docId)}" 
                                 data-filepath="${escapeHtml(filePath)}"
                                 data-detail="${escapeHtml(detailData)}">
                                <div class="media-thumb">
                                    <img src="${fullUrl}"
                                         alt="${safeLabel}"
                                         onerror="imageFallbackToLink(this, '${fullUrl.replace(/'/g,"\\'")}', '${safeLabel.replace(/'/g,"\\'")}')" />
                                </div>
                                <div class="media-body">
                                    <span class="media-title">Activity: ${escapeHtml(displayActivity || "(No Activity)")}</span>
                                    <div style="color:#6b7280;">Club: ${escapeHtml(displayClub || "(No Club)")}</div>
                                    <div>Time of Activity: ${escapeHtml(userID || "(unknown)")}</div>
                                    <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} </div>
                                    <div style="color:#6b7280; margin-top:4px;">${safeLabel}</div>
                                    <div class="image-error"></div>
                                    ${isAdminLoggedIn ? `
                                        <button class="btn btn-primary btn-sm edit-btn me-2" style="margin-top:8px;">
                                            Edit
                                        </button>
                                        <button class="btn btn-danger btn-sm delete-btn" style="margin-top:8px;">
                                            Delete
                                        </button>
                                    ` : ""}
                                </div>
                            </div>
                        `);
                    }
                } catch (err) {
                    console.error("Error building card:", err, val);
                    cards.push(`
                        <div class="media-card">
                            <div class="media-body">
                                <span class="media-title" style="color:#b91c1c;">Failed to load item</span>
                            </div>
                        </div>
                    `);
                }
            });

            // 显示筛选结果
            if (cards.length === 0) {
                $list.html(`<p>No media found matching "${searchTerm}". Try another keyword.</p>`);
            } else {
                $list.html(cards.join(""));
            }
        },
        error: (xhr, status, error) => {
            console.error("Error fetching media (filter):", status, error, xhr?.responseText);
            $list.html("<p style='color:red;'>Error loading filtered media. Check console.</p>");
        },
    });
}

// === 修改活动（管理员专属，核心修复：传递所有必需字段） ===
function submitModifyAsset() {
    // 1. 获取所有参数（含隐藏字段）
    const docId = $('#editDocId').val().trim();
    const newUserName = $('#editUserName').val().trim() || ""; // 必需：Logic App依赖
    const newFileName = $('#editFileName').val().trim() || ""; // 必需：Logic App依赖
    const newActivityName = $('#editActivityName').val().trim();
    const newClubName = $('#editClubName').val().trim();
    const newUserID = $('#editUserID').val().trim();
    const newDesc = $('#editActivityDescription').val().trim();

    // 2. 校验文档ID
    if (!docId) {
        alert("Failed to get activity ID! Please refresh and try again.");
        return;
    }

    // 3. 构建修改参数（强制传递userName和fileName，避免Logic App字段缺失）
    const modifyParams = new URLSearchParams();
    modifyParams.append('id', docId); // 必传：定位文档
    modifyParams.append('userName', newUserName); // 必传：Logic App依赖
    modifyParams.append('fileName', newFileName); // 必传：Logic App依赖
    // 可选字段：仅传递有修改的值
    if (newActivityName) modifyParams.append('activityName', newActivityName);
    if (newClubName) modifyParams.append('clubName', newClubName);
    if (newUserID) modifyParams.append('userID', newUserID);
    if (newDesc) modifyParams.append('activityDescription', newDesc);

    // 4. 构建请求URL（含调试日志）
    const modifyUrl = `${MODIFY_MEDIA}&${modifyParams.toString()}`;
    console.log("Modify request URL:", modifyUrl); // 调试用：确认参数完整

    // 5. 发送PUT请求（与Logic App触发器方法一致）
    $.ajax({
        url: modifyUrl,
        type: "PUT",
        success: (response) => {
            console.log("Modify success:", response);
            alert("Activity updated successfully!");
            // 关闭模态框并刷新列表
            const editModal = bootstrap.Modal.getInstance(document.getElementById('activityEditModal'));
            editModal.hide();
            getImages();
        },
        error: (xhr, status, err) => {
            console.error("Modify failed:", status, err, xhr?.responseText);
            alert(`Modify failed: ${status} - ${err}`);
        }
    });
}

// === 工具函数 ===
// 解码Base64字段（兼容Azure返回的Base64格式）
function unwrapMaybeBase64(value) {
    if (value && typeof value === "object" && "$content" in value) {
        try { return atob(value.$content); } catch { return value.$content || ""; }
    }
    return value || "";
}

// 构建Blob存储的完整URL
function buildBlobUrl(filePath) {
    if (!filePath) return "";
    const trimmed = String(filePath).trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const left = (BLOB_ACCOUNT || "").replace(/\/+$/g, "");
    const right = trimmed.replace(/^\/+/g, "");
    return `${left}/${right}`;
}

// 判断是否为视频文件
function isLikelyVideo({ contentType, url, fileName }) {
    const ct = (contentType || "").toLowerCase();
    if (ct.startsWith("video/")) return true;
    const target = ((url || "") + " " + (fileName || "")).toLowerCase();
    return /\.(mp4|m4v|webm|og[gv]|mov|avi)(\?|#|$)/.test(target);
}

// 图片加载失败时降级为链接
function imageFallbackToLink(imgEl, url, label) {
    const card = imgEl.closest(".media-card");
    if (!card) return;
    const thumb = card.querySelector(".media-thumb");
    const errMsg = card.querySelector(".image-error");
    if (thumb) {
        thumb.innerHTML = `<a href="${url}" target="_blank" rel="noopener" class="video-link">${label || url}</a>`;
    }
    if (errMsg) {
        errMsg.textContent = "Image failed to load — opened as link instead.";
        errMsg.style.display = "block";
    }
}

// 转义HTML特殊字符（防止XSS和语法错误）
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}