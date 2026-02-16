// رقم المدير العام للصيانة (واتساب)
const MANAGER_PHONE = "201555153901"; // بدون + وبدون صفر في البداية للواتساب
const MANAGER_DISPLAY_PHONE = "+20 15 55153901";

// تهيئة Firebase بنفس إعدادات التطبيق الرئيسي
const firebaseConfig = {
    apiKey: "AIzaSyDjImFc52SF5TlN7k7vz0H6-8bWl8Pkz0k",
    authDomain: "haat-a88ee.firebaseapp.com",
    databaseURL: "https://haat-a88ee-default-rtdb.firebaseio.com",
    projectId: "haat-a88ee",
    storageBucket: "haat-a88ee.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// متغيرات التطبيق
let currentSupervisor = null;
let supervisors = [];
let employees = [];
let stations = [];
let attendance = [];
let leaves = [];
let faults = [];
let financials = [];
let isConnected = false;
let autoRefreshInterval = null;

// متغيرات PWA
let deferredPrompt;
const installPrompt = document.getElementById('installPrompt');
const installAppBtn = document.getElementById('installApp');
const closeInstallBtn = document.getElementById('closeInstall');

// عناصر DOM
const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const supervisorSelect = document.getElementById('supervisorName');
const supervisorPassword = document.getElementById('supervisorPassword');
const loginError = document.getElementById('loginError');
const loginBtnText = document.getElementById('loginBtnText');
const loginButton = document.getElementById('loginButton');
const currentUserName = document.getElementById('currentUserName');
const logoutBtn = document.getElementById('logoutBtn');
const bottomNav = document.getElementById('bottomNav');
const mainContent = document.getElementById('mainContent');
const pageTitle = document.getElementById('pageTitle');
const connectionStatus = document.getElementById('connectionStatus');
const rememberMeCheckbox = document.getElementById('rememberMe');

// ==================== كود PWA للتثبيت على الشاشة الرئيسية ====================

// التحقق مما إذا كان التطبيق مثبتاً بالفعل
function isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
}

// إظهار رسالة التثبيت إذا كان التطبيق غير مثبت والمتصفح يدعم PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // إظهار رسالة التثبيت إذا لم يكن التطبيق مثبتاً
    if (!isAppInstalled() && !localStorage.getItem('installPromptClosed')) {
        setTimeout(() => {
            installPrompt.classList.add('show');
        }, 3000);
    }
});

// تثبيت التطبيق
installAppBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
        showTemporaryMessage('التثبيت غير متاح حالياً', 'error');
        return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        console.log('تم تثبيت التطبيق');
        installPrompt.classList.remove('show');
        localStorage.setItem('appInstalled', 'true');
        showTemporaryMessage('تم تثبيت التطبيق بنجاح على الشاشة الرئيسية', 'success');
    }
    
    deferredPrompt = null;
});

// إغلاق رسالة التثبيت
closeInstallBtn.addEventListener('click', () => {
    installPrompt.classList.remove('show');
    localStorage.setItem('installPromptClosed', 'true');
});

// إظهار رسالة التثبيت عند فتح التطبيق من المتصفح
document.addEventListener('DOMContentLoaded', () => {
    if (!isAppInstalled() && !localStorage.getItem('installPromptClosed') && !localStorage.getItem('appInstalled')) {
        // انتظر 3 ثواني ثم أظهر الرسالة
        setTimeout(() => {
            if (deferredPrompt) {
                installPrompt.classList.add('show');
            }
        }, 3000);
    }
    
    loadSupervisors();
    checkSavedSession();
    startAutoDateRefresh();
});

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    monitorConnection();
    loadSupervisors();
    
    // التحقق من وجود جلسة سابقة
    checkSavedSession();
    
    // بدء التحديث التلقائي للتاريخ كل دقيقة
    startAutoDateRefresh();
});

// بدء التحديث التلقائي للتاريخ
function startAutoDateRefresh() {
    // التحقق كل دقيقة إذا كان التاريخ الحالي مختلف عن التاريخ المعروض
    autoRefreshInterval = setInterval(() => {
        if (appContainer.style.display === 'block' && currentSupervisor) {
            // تحديث التواريخ في الصفحات المفتوحة
            updateDatesInCurrentPage();
        }
    }, 60000); // كل دقيقة
}

// تحديث التواريخ في الصفحة الحالية
function updateDatesInCurrentPage() {
    const today = getTodayDate();
    
    // تحديث حقل التاريخ في نموذج الحضور إذا كان موجوداً
    const attendanceDate = document.getElementById('attendanceDate');
    if (attendanceDate && attendanceDate.value !== today) {
        attendanceDate.value = today;
    }
    
    // تحديث حقل التاريخ في فلتر الحضور
    const filterAttendanceDate = document.getElementById('filterAttendanceDate');
    if (filterAttendanceDate && filterAttendanceDate.value !== today) {
        filterAttendanceDate.value = today;
    }
    
    // تحديث حقل التاريخ في نموذج الأعطال
    const faultDate = document.getElementById('faultDate');
    if (faultDate && faultDate.value !== today) {
        faultDate.value = today;
    }
    
    // تحديث حقل التاريخ في نموذج الإجازات
    const leaveStart = document.getElementById('leaveStart');
    if (leaveStart && leaveStart.value !== today) {
        leaveStart.value = today;
    }
    
    const leaveEnd = document.getElementById('leaveEnd');
    if (leaveEnd && leaveEnd.value !== today) {
        leaveEnd.value = today;
    }
    
    // تحديث حقل التاريخ في نموذج الحركات المالية
    const financialDate = document.getElementById('financialDate');
    if (financialDate && financialDate.value !== today) {
        financialDate.value = today;
    }
    
    const filterFinancialDate = document.getElementById('filterFinancialDate');
    if (filterFinancialDate && filterFinancialDate.value !== today) {
        filterFinancialDate.value = today;
    }
}

// الحصول على تاريخ اليوم بصيغة YYYY-MM-DD
function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// التحقق من وجود جلسة سابقة
function checkSavedSession() {
    const savedSession = localStorage.getItem('attendance_supervisor_session');
    
    if (savedSession) {
        try {
            const sessionData = JSON.parse(savedSession);
            const expiryTime = sessionData.expiry || 0;
            
            // التحقق من أن الجلسة لم تنته (صلاحية غير محدودة)
            if (sessionData.supervisorId && sessionData.supervisorName) {
                // عرض شاشة التحميل
                showLoading(true);
                
                // تحميل المسؤولين أولاً
                database.ref('supervisors').once('value')
                    .then((snapshot) => {
                        const data = snapshot.val();
                        if (data) {
                            supervisors = Object.keys(data).map(key => {
                                return { id: key, ...data[key] };
                            });
                            
                            const supervisor = supervisors.find(s => s.id === sessionData.supervisorId);
                            
                            if (supervisor && supervisor.active) {
                                // استعادة الجلسة
                                currentSupervisor = supervisor;
                                currentUserName.textContent = supervisor.employeeName;
                                
                                // إخفاء شاشة الدخول وإظهار التطبيق
                                loginScreen.style.display = 'none';
                                appContainer.style.display = 'block';
                                
                                // تحميل البيانات
                                loadAllData();
                                
                                // إظهار رسالة ترحيب
                                showTemporaryMessage(`مرحباً بعودتك ${supervisor.employeeName}`, 'success');
                            } else {
                                // المسؤول غير موجود أو غير نشط
                                localStorage.removeItem('attendance_supervisor_session');
                                showLoading(false);
                            }
                        } else {
                            localStorage.removeItem('attendance_supervisor_session');
                            showLoading(false);
                        }
                    })
                    .catch(error => {
                        console.error('خطأ في استعادة الجلسة:', error);
                        localStorage.removeItem('attendance_supervisor_session');
                        showLoading(false);
                    });
            } else {
                showLoading(false);
            }
        } catch (error) {
            console.error('خطأ في تحليل بيانات الجلسة:', error);
            localStorage.removeItem('attendance_supervisor_session');
            showLoading(false);
        }
    }
}

// حفظ الجلسة
function saveSession(supervisor, remember = true) {
    if (remember) {
        const sessionData = {
            supervisorId: supervisor.id,
            supervisorName: supervisor.employeeName,
            loginTime: new Date().toISOString()
        };
        localStorage.setItem('attendance_supervisor_session', JSON.stringify(sessionData));
    } else {
        // استخدام sessionStorage بدلاً من localStorage (ينتهي عند إغلاق المتصفح)
        const sessionData = {
            supervisorId: supervisor.id,
            supervisorName: supervisor.employeeName,
            loginTime: new Date().toISOString()
        };
        sessionStorage.setItem('attendance_supervisor_session', JSON.stringify(sessionData));
    }
}

// مراقبة حالة الاتصال
function monitorConnection() {
    const connectedRef = firebase.database().ref(".info/connected");
    connectedRef.on("value", function(snap) {
        isConnected = snap.val() === true;
        if (isConnected) {
            showConnectionStatus('متصل بقاعدة البيانات', 'success');
        } else {
            showConnectionStatus('غير متصل - يرجى التحقق من الاتصال', 'error');
        }
    });
}

function showConnectionStatus(message, type) {
    connectionStatus.style.display = 'block';
    connectionStatus.style.background = type === 'success' ? 
        'linear-gradient(135deg, var(--success) 0%, var(--success-dark) 100%)' : 
        'linear-gradient(135deg, var(--danger) 0%, var(--danger-dark) 100%)';
    connectionStatus.innerHTML = `<i class="fas fa-${type === 'success' ? 'wifi' : 'wifi-slash'}"></i> ${message}`;
    
    if (type === 'success') {
        setTimeout(() => {
            connectionStatus.style.display = 'none';
        }, 3000);
    }
}

// تحميل قائمة المسؤولين من Firebase
function loadSupervisors() {
    database.ref('supervisors').once('value')
        .then((snapshot) => {
            const data = snapshot.val();
            if (data) {
                supervisors = Object.keys(data).map(key => {
                    return { id: key, ...data[key] };
                });
            }
            populateSupervisorSelect();
        })
        .catch(error => {
            console.error('خطأ في تحميل المسؤولين:', error);
            showLoginError('فشل تحميل بيانات المسؤولين');
        });
}

// تعبئة قائمة المسؤولين في شاشة الدخول
function populateSupervisorSelect() {
    supervisorSelect.innerHTML = '<option value="">اختر اسمك من القائمة</option>';
    
    const activeSupervisors = supervisors.filter(sup => sup.active);
    
    if (activeSupervisors.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'لا يوجد مسؤولين نشطين';
        option.disabled = true;
        supervisorSelect.appendChild(option);
        return;
    }
    
    activeSupervisors.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    
    activeSupervisors.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup.id;
        option.textContent = sup.employeeName;
        supervisorSelect.appendChild(option);
    });
}

// تسجيل الدخول
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const supervisorId = supervisorSelect.value;
    const password = supervisorPassword.value;
    const rememberMe = rememberMeCheckbox.checked;
    
    if (!supervisorId || !password) {
        showLoginError('يرجى اختيار اسم المسؤول وإدخال كلمة السر');
        return;
    }
    
    const supervisor = supervisors.find(s => s.id === supervisorId);
    
    if (supervisor && supervisor.password === password) {
        // تسجيل الدخول ناجح
        currentSupervisor = supervisor;
        currentUserName.textContent = supervisor.employeeName;
        
        // حفظ الجلسة
        saveSession(supervisor, rememberMe);
        
        // إخفاء شاشة الدخول وإظهار التطبيق
        loginScreen.style.display = 'none';
        appContainer.style.display = 'block';
        
        // تحميل البيانات الضرورية
        loadAllData();
        
        // إظهار رسالة ترحيب
        showTemporaryMessage(`مرحباً ${supervisor.employeeName}`, 'success');
    } else {
        showLoginError('اسم المسؤول أو كلمة السر غير صحيحة');
    }
});

// إظهار خطأ تسجيل الدخول
function showLoginError(message) {
    document.getElementById('errorText').textContent = message;
    loginError.style.display = 'block';
    loginButton.style.animation = 'shake 0.5s ease';
    
    setTimeout(() => {
        loginError.style.display = 'none';
        loginButton.style.animation = '';
    }, 3000);
}

// إضافة تأثير الاهتزاز
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// تسجيل الخروج
logoutBtn.addEventListener('click', function() {
    // حذف الجلسة من جميع التخزينات
    localStorage.removeItem('attendance_supervisor_session');
    sessionStorage.removeItem('attendance_supervisor_session');
    
    currentSupervisor = null;
    appContainer.style.display = 'none';
    loginScreen.style.display = 'flex';
    loginScreen.style.flexDirection = 'column';
    loginScreen.style.justifyContent = 'center';
    supervisorSelect.value = '';
    supervisorPassword.value = '';
    
    // إيقاف التحديث التلقائي
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
});

// التنقل بين الصفحات
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        const page = this.getAttribute('data-page');
        
        // تحديث النشط
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        this.classList.add('active');
        
        // عرض الصفحة المناسبة
        showPage(page);
    });
});

// عرض الصفحة المحددة
function showPage(page) {
    const titles = {
        'dashboard': 'الرئيسية',
        'attendance': 'تسجيل الحضور',
        'leaves': 'إدارة الإجازات',
        'faults': 'تسجيل الأعطال',
        'financial': 'السلف والمكافآت'
    };
    
    pageTitle.innerHTML = `<i class="fas fa-${getIconForPage(page)}"></i> <span>${titles[page]}</span>`;
    
    switch(page) {
        case 'dashboard':
            showDashboard();
            break;
        case 'attendance':
            showAttendancePage();
            break;
        case 'leaves':
            showLeavesPage();
            break;
        case 'faults':
            showFaultsPage();
            break;
        case 'financial':
            showFinancialPage();
            break;
    }
}

function getIconForPage(page) {
    const icons = {
        'dashboard': 'home',
        'attendance': 'user-check',
        'leaves': 'umbrella-beach',
        'faults': 'exclamation-triangle',
        'financial': 'hand-holding-usd'
    };
    return icons[page];
}

// تحميل جميع البيانات
function loadAllData() {
    showLoading(true);
    
    Promise.all([
        loadData('employees'),
        loadData('stations'),
        loadData('attendance'),
        loadData('leaves'),
        loadData('faults'),
        loadData('financials')
    ]).then(() => {
        showLoading(false);
        showDashboard();
        showConnectionStatus('تم تحميل البيانات بنجاح', 'success');
    }).catch(error => {
        console.error('خطأ في تحميل البيانات:', error);
        showLoading(false);
        showError('حدث خطأ في تحميل البيانات');
    });
}

// تحميل بيانات من Firebase
function loadData(dataType) {
    return new Promise((resolve, reject) => {
        database.ref(dataType).once('value')
            .then((snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const dataArray = Object.keys(data).map(key => {
                        return { id: key, ...data[key] };
                    });
                    
                    if (dataType === 'employees') employees = dataArray;
                    else if (dataType === 'stations') stations = dataArray;
                    else if (dataType === 'attendance') attendance = dataArray;
                    else if (dataType === 'leaves') leaves = dataArray;
                    else if (dataType === 'faults') faults = dataArray;
                    else if (dataType === 'financials') financials = dataArray;
                } else {
                    if (dataType === 'employees') employees = [];
                    else if (dataType === 'stations') stations = [];
                    else if (dataType === 'attendance') attendance = [];
                    else if (dataType === 'leaves') leaves = [];
                    else if (dataType === 'faults') faults = [];
                    else if (dataType === 'financials') financials = [];
                }
                resolve();
            })
            .catch(error => {
                console.error(`خطأ في تحميل ${dataType}:`, error);
                reject(error);
            });
    });
}

// إضافة بيانات إلى Firebase
function addData(dataType, newItem) {
    return new Promise((resolve, reject) => {
        const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        
        database.ref(`${dataType}/${newId}`).set(newItem)
            .then(() => {
                const itemWithId = { id: newId, ...newItem };
                
                if (dataType === 'attendance') attendance.push(itemWithId);
                else if (dataType === 'leaves') leaves.push(itemWithId);
                else if (dataType === 'faults') faults.push(itemWithId);
                else if (dataType === 'financials') financials.push(itemWithId);
                
                resolve(itemWithId);
            })
            .catch(error => {
                console.error(`خطأ في إضافة ${dataType}:`, error);
                reject(error);
            });
    });
}

// إرسال إشعار واتساب للمدير العام عند تسجيل عطل جديد
function sendFaultNotificationToManager(faultData) {
    try {
        // تكوين رسالة الإشعار
        const message = `🚨 *تنبيه عطل جديد* 🚨
        
🔧 *العنوان:* ${faultData.title}
📍 *المحطة:* ${faultData.stationName}
📝 *التفاصيل:* ${faultData.description}
📅 *التاريخ:* ${faultData.date}
👤 *المسجل:* ${faultData.supervisorName}
⏰ *الوقت:* ${new Date().toLocaleTimeString('ar-EG')}

يرجى فتح التطبيق لمتابعة المزيد من التفاصيل.`;

        // ترميز الرسالة للواتساب
        const encodedMessage = encodeURIComponent(message);
        
        // رابط واتساب (بدون + وبدون صفر في البداية)
        const whatsappUrl = `https://wa.me/${MANAGER_PHONE}?text=${encodedMessage}`;
        
        // فتح واتساب في نافذة جديدة
        window.open(whatsappUrl, '_blank');
        
        console.log('تم إرسال إشعار للمدير العام عبر واتساب');
        return true;
    } catch (error) {
        console.error('خطأ في إرسال إشعار واتساب:', error);
        return false;
    }
}

// عرض مؤشر التحميل
function showLoading(show) {
    if (show) {
        mainContent.innerHTML = `
            <div class="loading-large">
                <div class="spinner"></div>
                <p style="color: var(--gray); font-size: 1.1rem;">جاري تحميل البيانات...</p>
            </div>
        `;
    }
}

// عرض رسالة خطأ
function showError(message) {
    mainContent.innerHTML = `
        <div class="alert alert-error" style="text-align: center; padding: 40px 20px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px; display: block;"></i>
            <p style="margin-bottom: 20px; font-size: 1.1rem;">${message}</p>
            <button onclick="loadAllData()" style="width: auto; padding: 15px 30px; margin: 0 auto;">
                <i class="fas fa-sync-alt"></i> إعادة المحاولة
            </button>
        </div>
    `;
}

// ==================== صفحة لوحة التحكم (مع عرض جميع حالات الموظفين) ====================
function showDashboard() {
    const today = getTodayDate();
    
    // إحصائيات اليوم
    const todayAttendance = attendance.filter(a => a.date === today && a.supervisorId === currentSupervisor.id);
    const todayLeaves = leaves.filter(l => l.start <= today && l.end >= today && l.supervisorId === currentSupervisor.id);
    const pendingFaults = faults.filter(f => f.status !== 'fixed' && f.supervisorId === currentSupervisor.id);
    const todayFinancials = financials.filter(f => f.date === today && f.supervisorId === currentSupervisor.id);
    
    // تجميع جميع الموظفين الذين سجل لهم المسؤول حضور/غياب/إجازة اليوم
    const employeeStatusToday = attendance.filter(a => a.date === today && a.supervisorId === currentSupervisor.id);
    
    mainContent.innerHTML = `
        <div class="welcome-message">
            <h3><i class="fas fa-sun"></i> مرحباً ${currentSupervisor.employeeName}</h3>
            <p>تاريخ اليوم: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
        
        <div class="quick-stats">
            <div class="stat-card">
                <div class="stat-value">${todayAttendance.length}</div>
                <div class="stat-label">تسجيلات اليوم</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${todayLeaves.length}</div>
                <div class="stat-label">إجازات اليوم</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${pendingFaults.length}</div>
                <div class="stat-label">أعطال نشطة</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${todayFinancials.length}</div>
                <div class="stat-label">حركات مالية</div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <i class="fas fa-clipboard-list"></i> حالة الموظفين اليوم (${today})
            </div>
            <div class="card-body" id="employeeStatusContainer">
                ${displayEmployeeStatusToday(employeeStatusToday)}
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <i class="fas fa-clock"></i> آخر تسجيلات الحضور
            </div>
            <div class="card-body">
                ${displayRecentAttendance()}
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <i class="fas fa-exclamation-triangle"></i> الأعطال النشطة
            </div>
            <div class="card-body">
                ${displayActiveFaults()}
            </div>
        </div>
    `;
}

// دالة جديدة لعرض جميع حالات الموظفين في بطاقات منفصلة
function displayEmployeeStatusToday(statusList) {
    if (statusList.length === 0) {
        return '<div class="empty-state"><i class="fas fa-user-slash"></i>لا يوجد أي موظف مسجل له حالة اليوم</div>';
    }
    
    // ترتيب حسب الحالة (حاضر أولاً) ثم الاسم
    const sorted = [...statusList].sort((a, b) => {
        if (a.status === 'حاضر' && b.status !== 'حاضر') return -1;
        if (a.status !== 'حاضر' && b.status === 'حاضر') return 1;
        return a.employeeName.localeCompare(b.employeeName);
    });
    
    let html = '';
    sorted.forEach(record => {
        const statusClass = record.status === 'حاضر' ? 'status-present' : 
                           record.status === 'غائب' ? 'status-absent' : 'status-leave';
        const statusIcon = record.status === 'حاضر' ? '✅' : 
                          record.status === 'غائب' ? '❌' : '🏖️';
        
        html += `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-title">${record.employeeName}</div>
                    <div class="item-subtitle">
                        <span class="station-badge">${record.stationName}</span>
                    </div>
                </div>
                <div class="${statusClass}">${statusIcon} ${record.status}</div>
            </div>
        `;
    });
    return html;
}

function displayRecentAttendance() {
    const recent = attendance
        .filter(a => a.supervisorId === currentSupervisor.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    
    if (recent.length === 0) {
        return '<div class="empty-state"><i class="fas fa-calendar-times"></i>لا توجد تسجيلات حديثة</div>';
    }
    
    let html = '';
    recent.forEach(record => {
        const statusClass = record.status === 'حاضر' ? 'status-present' : 
                           record.status === 'غائب' ? 'status-absent' : 'status-leave';
        html += `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-title">${record.employeeName}</div>
                    <div class="item-subtitle">
                        <span class="station-badge">${record.stationName || 'غير محدد'}</span>
                        <span>${record.date}</span>
                    </div>
                </div>
                <div class="${statusClass}">${record.status}</div>
            </div>
        `;
    });
    return html;
}

function displayActiveFaults() {
    const active = faults
        .filter(f => f.status !== 'fixed' && f.supervisorId === currentSupervisor.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    
    if (active.length === 0) {
        return '<div class="empty-state"><i class="fas fa-check-circle"></i>لا توجد أعطال نشطة</div>';
    }
    
    let html = '';
    active.forEach(fault => {
        const statusClass = fault.status === 'in-progress' ? 'status-leave' : 'status-absent';
        const statusText = fault.status === 'in-progress' ? 'جاري الإصلاح' : 'لم يتم الإصلاح';
        
        html += `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-title">${fault.title}</div>
                    <div class="item-subtitle">
                        <span class="station-badge">${fault.stationName}</span>
                        <span class="${statusClass}">${statusText}</span>
                    </div>
                    <div class="item-subtitle">${fault.date}</div>
                </div>
            </div>
        `;
    });
    return html;
}

// ==================== صفحة تسجيل الحضور (مع تعطيل التواريخ الماضية) ====================
function showAttendancePage() {
    const today = getTodayDate();
    
    mainContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <i class="fas fa-user-check"></i> تسجيل الحضور والغياب
            </div>
            <div class="card-body">
                <form id="attendanceForm">
                    <div class="form-group">
                        <label><i class="fas fa-user"></i> الموظف</label>
                        <select id="attendanceEmployee" required>
                            <option value="">اختر الموظف</option>
                            ${getEmployeesOptions()}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-building"></i> المحطة</label>
                        <select id="attendanceStation" required>
                            <option value="">اختر المحطة</option>
                            ${getStationsOptions()}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-calendar"></i> التاريخ</label>
                        <input type="date" id="attendanceDate" value="${today}" min="${today}" required>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-tag"></i> الحالة</label>
                        <select id="attendanceStatus" required>
                            <option value="حاضر">✅ حاضر (موجود في المحطة)</option>
                            <option value="غائب">❌ غائب (غير موجود)</option>
                            <option value="إجازة">🏖️ إجازة</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn-success">
                        <span id="attendanceSubmitText"><i class="fas fa-save"></i> تسجيل الحضور</span>
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <i class="fas fa-history"></i> آخر تسجيلاتي
            </div>
            <div class="card-body">
                <div class="filter-section">
                    <div class="form-group">
                        <label><i class="fas fa-filter"></i> فلترة حسب التاريخ</label>
                        <input type="date" id="filterAttendanceDate" value="${today}" min="${today}">
                    </div>
                </div>
                <div id="myAttendanceList">
                    ${displayMyAttendance(today)}
                </div>
            </div>
        </div>
    `;
    
    // إضافة مستمع الحدث للنموذج
    document.getElementById('attendanceForm').addEventListener('submit', recordAttendance);
    document.getElementById('filterAttendanceDate').addEventListener('change', function() {
        document.getElementById('myAttendanceList').innerHTML = displayMyAttendance(this.value);
    });
}

function getEmployeesOptions() {
    const activeEmployees = employees.filter(emp => emp.active);
    if (activeEmployees.length === 0) {
        return '<option value="" disabled>لا يوجد موظفين نشطين</option>';
    }
    return activeEmployees.map(emp => 
        `<option value="${emp.name}">${emp.name}</option>`
    ).join('');
}

function getStationsOptions() {
    if (stations.length === 0) {
        return '<option value="" disabled>لا توجد محطات مسجلة</option>';
    }
    return stations.map(station => 
        `<option value="${station.name}">${station.name}</option>`
    ).join('');
}

function recordAttendance(e) {
    e.preventDefault();
    
    const employeeName = document.getElementById('attendanceEmployee').value;
    const stationName = document.getElementById('attendanceStation').value;
    const date = document.getElementById('attendanceDate').value;
    const status = document.getElementById('attendanceStatus').value;
    
    if (!employeeName || !stationName || !date || !status) {
        showTemporaryMessage('يرجى ملء جميع الحقول', 'error');
        return;
    }
    
    const existingRecord = attendance.find(record => 
        record.employeeName === employeeName && record.date === date
    );
    
    const submitBtn = document.getElementById('attendanceSubmitText');
    submitBtn.innerHTML = '<div class="loading"></div> جاري التسجيل...';
    
    const newAttendance = {
        employeeName,
        stationName,
        supervisorId: currentSupervisor.id,
        supervisorName: currentSupervisor.employeeName,
        date,
        status,
        timestamp: new Date().toISOString()
    };
    
    let promise;
    
    if (existingRecord) {
        promise = database.ref(`attendance/${existingRecord.id}`).update(newAttendance)
            .then(() => {
                const index = attendance.findIndex(a => a.id === existingRecord.id);
                if (index !== -1) attendance[index] = { ...attendance[index], ...newAttendance, id: existingRecord.id };
            });
    } else {
        promise = addData('attendance', newAttendance);
    }
    
    promise.then(() => {
        submitBtn.innerHTML = '<i class="fas fa-check"></i> تم التسجيل بنجاح';
        document.getElementById('attendanceForm').reset();
        document.getElementById('attendanceDate').value = getTodayDate();
        
        setTimeout(() => {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> تسجيل الحضور';
        }, 2000);
        
        // تحديث القائمة
        const filterDate = document.getElementById('filterAttendanceDate').value;
        document.getElementById('myAttendanceList').innerHTML = displayMyAttendance(filterDate);
        
        showTemporaryMessage('تم تسجيل الحضور بنجاح', 'success');
    }).catch(error => {
        submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> حدث خطأ';
        console.error(error);
        showTemporaryMessage('حدث خطأ في التسجيل', 'error');
    });
}

function displayMyAttendance(date) {
    const myAttendance = attendance
        .filter(a => a.supervisorId === currentSupervisor.id && a.date === date)
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    
    if (myAttendance.length === 0) {
        return '<div class="empty-state"><i class="fas fa-calendar-times"></i>لا توجد تسجيلات لهذا اليوم</div>';
    }
    
    let html = '';
    myAttendance.forEach(record => {
        const statusClass = record.status === 'حاضر' ? 'status-present' : 
                           record.status === 'غائب' ? 'status-absent' : 'status-leave';
        const statusIcon = record.status === 'حاضر' ? '✅' : 
                          record.status === 'غائب' ? '❌' : '🏖️';
        
        html += `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-title">${record.employeeName}</div>
                    <div class="item-subtitle">
                        <span class="station-badge">${record.stationName}</span>
                    </div>
                </div>
                <div class="${statusClass}">${statusIcon} ${record.status}</div>
            </div>
        `;
    });
    return html;
}

// ==================== صفحة إدارة الإجازات (مع تعطيل التواريخ الماضية) ====================
function showLeavesPage() {
    const today = getTodayDate();
    
    mainContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <i class="fas fa-umbrella-beach"></i> تسجيل إجازة جديدة
            </div>
            <div class="card-body">
                <form id="leaveForm">
                    <div class="form-group">
                        <label><i class="fas fa-user"></i> الموظف</label>
                        <select id="leaveEmployee" required>
                            <option value="">اختر الموظف</option>
                            ${getEmployeesOptions()}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-building"></i> المحطة</label>
                        <select id="leaveStation" required>
                            <option value="">اختر المحطة</option>
                            ${getStationsOptions()}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-tag"></i> نوع الإجازة</label>
                        <select id="leaveType" required>
                            <option value="سنوية">📅 سنوية</option>
                            <option value="مرضية">🏥 مرضية</option>
                            <option value="طارئة">⚡ طارئة</option>
                            <option value="أخرى">🔄 أخرى</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-calendar-start"></i> تاريخ البدء</label>
                        <input type="date" id="leaveStart" value="${today}" min="${today}" required>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-calendar-end"></i> تاريخ الانتهاء</label>
                        <input type="date" id="leaveEnd" value="${today}" min="${today}" required>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-sticky-note"></i> ملاحظات</label>
                        <textarea id="leaveNotes" rows="3" placeholder="أدخل ملاحظات حول الإجازة (اختياري)"></textarea>
                    </div>
                    
                    <button type="submit" class="btn-warning">
                        <span id="leaveSubmitText"><i class="fas fa-save"></i> تسجيل الإجازة</span>
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <i class="fas fa-list"></i> الإجازات النشطة
            </div>
            <div class="card-body" id="activeLeavesList">
                ${displayActiveLeaves()}
            </div>
        </div>
    `;
    
    document.getElementById('leaveForm').addEventListener('submit', recordLeave);
}

function recordLeave(e) {
    e.preventDefault();
    
    const employeeName = document.getElementById('leaveEmployee').value;
    const stationName = document.getElementById('leaveStation').value;
    const type = document.getElementById('leaveType').value;
    const start = document.getElementById('leaveStart').value;
    const end = document.getElementById('leaveEnd').value;
    const notes = document.getElementById('leaveNotes').value;
    
    if (!employeeName || !stationName || !type || !start || !end) {
        showTemporaryMessage('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    if (new Date(start) > new Date(end)) {
        showTemporaryMessage('تاريخ البدء يجب أن يكون قبل تاريخ الانتهاء', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('leaveSubmitText');
    submitBtn.innerHTML = '<div class="loading"></div> جاري التسجيل...';
    
    const newLeave = {
        employeeName,
        stationName,
        supervisorId: currentSupervisor.id,
        supervisorName: currentSupervisor.employeeName,
        type,
        start,
        end,
        notes: notes || '',
        timestamp: new Date().toISOString()
    };
    
    addData('leaves', newLeave)
        .then(() => {
            submitBtn.innerHTML = '<i class="fas fa-check"></i> تم التسجيل بنجاح';
            document.getElementById('leaveForm').reset();
            document.getElementById('leaveStart').value = getTodayDate();
            document.getElementById('leaveEnd').value = getTodayDate();
            
            setTimeout(() => {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> تسجيل الإجازة';
            }, 2000);
            
            document.getElementById('activeLeavesList').innerHTML = displayActiveLeaves();
            showTemporaryMessage('تم تسجيل الإجازة بنجاح', 'success');
        })
        .catch(error => {
            submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> حدث خطأ';
            console.error(error);
            showTemporaryMessage('حدث خطأ في التسجيل', 'error');
        });
}

function displayActiveLeaves() {
    const today = getTodayDate();
    const activeLeaves = leaves
        .filter(l => l.end >= today && l.supervisorId === currentSupervisor.id)
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    if (activeLeaves.length === 0) {
        return '<div class="empty-state"><i class="fas fa-calendar-check"></i>لا توجد إجازات نشطة</div>';
    }
    
    let html = '';
    activeLeaves.forEach(leave => {
        html += `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-title">${leave.employeeName}</div>
                    <div class="item-subtitle">
                        <span class="station-badge">${leave.stationName}</span>
                        <span>${leave.type}</span>
                    </div>
                    <div class="item-subtitle">
                        <i class="fas fa-calendar"></i> من ${leave.start} إلى ${leave.end}
                    </div>
                </div>
            </div>
        `;
    });
    return html;
}

// ==================== صفحة تسجيل الأعطال (مع تعطيل التواريخ الماضية) ====================
function showFaultsPage() {
    const today = getTodayDate();
    
    mainContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <i class="fas fa-exclamation-triangle"></i> تسجيل عطل جديد
            </div>
            <div class="card-body">
                <div class="whatsapp-badge">
                    <i class="fab fa-whatsapp"></i>
                    سيتم إرسال إشعار فوري للمدير العام (${MANAGER_DISPLAY_PHONE})
                </div>
                
                <form id="faultForm">
                    <div class="form-group">
                        <label><i class="fas fa-building"></i> المحطة</label>
                        <select id="faultStation" required>
                            <option value="">اختر المحطة</option>
                            ${getStationsOptions()}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-heading"></i> عنوان العطل</label>
                        <input type="text" id="faultTitle" required placeholder="أدخل عنوان العطل">
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-align-left"></i> تفاصيل العطل</label>
                        <textarea id="faultDescription" rows="4" required placeholder="أدخل تفاصيل العطل"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-calendar"></i> تاريخ العطل</label>
                        <input type="date" id="faultDate" value="${today}" min="${today}" required>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-tag"></i> حالة العطل</label>
                        <select id="faultStatus" required>
                            <option value="pending">⏳ لم يتم الإصلاح</option>
                            <option value="in-progress">🔄 جاري الإصلاح</option>
                            <option value="fixed">✅ تم الإصلاح</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn-warning">
                        <span id="faultSubmitText"><i class="fas fa-save"></i> تسجيل العطل</span>
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <i class="fas fa-list"></i> الأعطال المسجلة
            </div>
            <div class="card-body">
                <div class="filter-section">
                    <div class="form-group">
                        <label><i class="fas fa-filter"></i> فلترة حسب الحالة</label>
                        <select id="filterFaultStatus">
                            <option value="">جميع الحالات</option>
                            <option value="pending">⏳ لم يتم الإصلاح</option>
                            <option value="in-progress">🔄 جاري الإصلاح</option>
                            <option value="fixed">✅ تم الإصلاح</option>
                        </select>
                    </div>
                </div>
                <div id="faultsList">
                    ${displayMyFaults()}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('faultForm').addEventListener('submit', recordFault);
    document.getElementById('filterFaultStatus').addEventListener('change', function() {
        document.getElementById('faultsList').innerHTML = displayMyFaults(this.value);
    });
}

function recordFault(e) {
    e.preventDefault();
    
    const stationName = document.getElementById('faultStation').value;
    const title = document.getElementById('faultTitle').value;
    const description = document.getElementById('faultDescription').value;
    const date = document.getElementById('faultDate').value;
    const status = document.getElementById('faultStatus').value;
    
    if (!stationName || !title || !description || !date || !status) {
        showTemporaryMessage('يرجى ملء جميع الحقول', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('faultSubmitText');
    submitBtn.innerHTML = '<div class="loading"></div> جاري التسجيل...';
    
    const newFault = {
        stationName,
        supervisorId: currentSupervisor.id,
        supervisorName: currentSupervisor.employeeName,
        title,
        description,
        date,
        status,
        timestamp: new Date().toISOString()
    };
    
    addData('faults', newFault)
        .then(() => {
            submitBtn.innerHTML = '<i class="fas fa-check"></i> تم التسجيل بنجاح';
            
            // إرسال إشعار واتساب للمدير العام
            const notificationSent = sendFaultNotificationToManager(newFault);
            
            if (notificationSent) {
                showTemporaryMessage('تم تسجيل العطل وإرسال إشعار للمدير العام', 'success');
            } else {
                showTemporaryMessage('تم تسجيل العطل ولكن فشل إرسال الإشعار', 'warning');
            }
            
            document.getElementById('faultForm').reset();
            document.getElementById('faultDate').value = getTodayDate();
            
            setTimeout(() => {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> تسجيل العطل';
            }, 3000);
            
            const filterStatus = document.getElementById('filterFaultStatus').value;
            document.getElementById('faultsList').innerHTML = displayMyFaults(filterStatus);
        })
        .catch(error => {
            submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> حدث خطأ';
            console.error(error);
            showTemporaryMessage('حدث خطأ في التسجيل', 'error');
        });
}

function displayMyFaults(statusFilter = '') {
    let filtered = faults
        .filter(f => f.supervisorId === currentSupervisor.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (statusFilter) {
        filtered = filtered.filter(f => f.status === statusFilter);
    }
    
    if (filtered.length === 0) {
        return '<div class="empty-state"><i class="fas fa-tools"></i>لا توجد أعطال مسجلة</div>';
    }
    
    let html = '';
    filtered.forEach(fault => {
        const statusClass = fault.status === 'fixed' ? 'status-present' :
                           fault.status === 'in-progress' ? 'status-leave' : 'status-absent';
        const statusText = fault.status === 'fixed' ? '✅ تم الإصلاح' :
                          fault.status === 'in-progress' ? '🔄 جاري الإصلاح' : '⏳ لم يتم الإصلاح';
        
        html += `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-title">${fault.title}</div>
                    <div class="item-subtitle">
                        <span class="station-badge">${fault.stationName}</span>
                        <span class="${statusClass}">${statusText}</span>
                    </div>
                    <div class="item-subtitle">
                        <i class="fas fa-calendar"></i> ${fault.date}
                    </div>
                    <div class="item-subtitle">
                        ${fault.description.substring(0, 60)}${fault.description.length > 60 ? '...' : ''}
                    </div>
                </div>
            </div>
        `;
    });
    return html;
}

// ==================== صفحة السلف والمكافآت (مع تعطيل التواريخ الماضية) ====================
function showFinancialPage() {
    const today = getTodayDate();
    
    mainContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <i class="fas fa-hand-holding-usd"></i> تسجيل حركة مالية
            </div>
            <div class="card-body">
                <form id="financialForm">
                    <div class="form-group">
                        <label><i class="fas fa-user"></i> الموظف</label>
                        <select id="financialEmployee" required>
                            <option value="">اختر الموظف</option>
                            ${getEmployeesOptions()}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-building"></i> المحطة</label>
                        <select id="financialStation" required>
                            <option value="">اختر المحطة</option>
                            ${getStationsOptions()}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-tag"></i> النوع</label>
                        <select id="financialType" required>
                            <option value="سلفة">💰 سلفة</option>
                            <option value="مكافأة">🎁 مكافأة</option>
                            <option value="خصم">📉 خصم</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-money-bill"></i> المبلغ (جنيه مصري)</label>
                        <input type="number" id="financialAmount" required placeholder="أدخل المبلغ" min="1">
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-calendar"></i> التاريخ</label>
                        <input type="date" id="financialDate" value="${today}" min="${today}" required>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-sticky-note"></i> ملاحظات</label>
                        <textarea id="financialNotes" rows="3" placeholder="أدخل ملاحظات حول الحركة المالية (اختياري)"></textarea>
                    </div>
                    
                    <button type="submit" class="btn-success">
                        <span id="financialSubmitText"><i class="fas fa-save"></i> تسجيل الحركة</span>
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <i class="fas fa-history"></i> آخر الحركات المالية
            </div>
            <div class="card-body">
                <div class="filter-section">
                    <div class="form-group">
                        <label><i class="fas fa-filter"></i> فلترة حسب التاريخ</label>
                        <input type="date" id="filterFinancialDate" value="${today}" min="${today}">
                    </div>
                </div>
                <div id="financialList">
                    ${displayMyFinancials(today)}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('financialForm').addEventListener('submit', recordFinancial);
    document.getElementById('filterFinancialDate').addEventListener('change', function() {
        document.getElementById('financialList').innerHTML = displayMyFinancials(this.value);
    });
}

function recordFinancial(e) {
    e.preventDefault();
    
    const employeeName = document.getElementById('financialEmployee').value;
    const stationName = document.getElementById('financialStation').value;
    const type = document.getElementById('financialType').value;
    const amount = parseInt(document.getElementById('financialAmount').value);
    const date = document.getElementById('financialDate').value;
    const notes = document.getElementById('financialNotes').value;
    
    if (!employeeName || !stationName || !type || !amount || !date) {
        showTemporaryMessage('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    if (amount <= 0) {
        showTemporaryMessage('يرجى إدخال مبلغ صحيح أكبر من صفر', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('financialSubmitText');
    submitBtn.innerHTML = '<div class="loading"></div> جاري التسجيل...';
    
    const newFinancial = {
        employeeName,
        stationName,
        supervisorId: currentSupervisor.id,
        supervisorName: currentSupervisor.employeeName,
        type,
        amount,
        date,
        notes: notes || '',
        timestamp: new Date().toISOString()
    };
    
    addData('financials', newFinancial)
        .then(() => {
            submitBtn.innerHTML = '<i class="fas fa-check"></i> تم التسجيل بنجاح';
            document.getElementById('financialForm').reset();
            document.getElementById('financialDate').value = getTodayDate();
            
            setTimeout(() => {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> تسجيل الحركة';
            }, 2000);
            
            const filterDate = document.getElementById('filterFinancialDate').value;
            document.getElementById('financialList').innerHTML = displayMyFinancials(filterDate);
            showTemporaryMessage('تم تسجيل الحركة بنجاح', 'success');
        })
        .catch(error => {
            submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> حدث خطأ';
            console.error(error);
            showTemporaryMessage('حدث خطأ في التسجيل', 'error');
        });
}

function displayMyFinancials(date) {
    const myFinancials = financials
        .filter(f => f.supervisorId === currentSupervisor.id && f.date === date)
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    
    if (myFinancials.length === 0) {
        return '<div class="empty-state"><i class="fas fa-coins"></i>لا توجد حركات مالية لهذا اليوم</div>';
    }
    
    let html = '';
    myFinancials.forEach(financial => {
        const amountClass = financial.type === 'مكافأة' ? 'status-present' :
                           financial.type === 'سلفة' ? 'status-absent' : 'status-leave';
        const amountIcon = financial.type === 'مكافأة' ? '🎁' :
                          financial.type === 'سلفة' ? '💰' : '📉';
        
        html += `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-title">${financial.employeeName}</div>
                    <div class="item-subtitle">
                        <span class="station-badge">${financial.stationName}</span>
                        <span>${financial.type}</span>
                    </div>
                </div>
                <div class="${amountClass}">${amountIcon} ${financial.amount} ج.م</div>
            </div>
        `;
    });
    return html;
}

// عرض رسالة مؤقتة
function showTemporaryMessage(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '80px';
    alertDiv.style.right = '15px';
    alertDiv.style.left = '15px';
    alertDiv.style.maxWidth = '400px';
    alertDiv.style.margin = '0 auto';
    alertDiv.style.zIndex = '1000';
    alertDiv.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    alertDiv.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'exclamation-circle'}"></i> ${message}`;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            alertDiv.remove();
        }, 300);
    }, 3000);
}

// إضافة تأثير fadeOut
const fadeStyle = document.createElement('style');
fadeStyle.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
    }
`;
document.head.appendChild(fadeStyle);