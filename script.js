import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCU0w5ffPZEmcIB0_ZYMGmn6VD2vuVkrOc",
  authDomain: "ie-handouts.firebaseapp.com",
  projectId: "ie-handouts",
  storageBucket: "ie-handouts.firebasestorage.app",
  databaseURL: "https://ie-handouts-default-rtdb.asia-southeast1.firebasedatabase.app",
  messagingSenderId: "23602413164",
  appId: "1:23602413164:web:600e3e8e0d4d20a0a26249",
  measurementId: "G-LMZM8ZV8NX"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Google Docs Style Routing
let path = window.location.pathname;
let match = path.match(/^\/h\/([a-zA-Z0-9_-]+)/);
let sessionId;

if (match) {
    sessionId = match[1];
} else {
    sessionId = 'default-homepage-lesson';
}

document.addEventListener('DOMContentLoaded', () => {
    /* -----------------------------------------------------------
       PAGE 1: Reveal Answers & Highlighting
    ----------------------------------------------------------- */
    const revealBtns = document.querySelectorAll('.reveal-btn');
    revealBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetElement = document.getElementById(targetId);
            const btnText = btn.querySelector('.btn-text');
            const isHidden = targetElement.classList.contains('hidden');

            if (isHidden) {
                targetElement.classList.remove('hidden');
                btn.setAttribute('aria-expanded', 'true');
                btn.classList.add('active');
                btnText.textContent = 'Hide Better Answer';
            } else {
                targetElement.classList.add('hidden');
                btn.setAttribute('aria-expanded', 'false');
                btn.classList.remove('active');
                btnText.textContent = 'Reveal Better Answer';
            }
        });
    });

    const questions = document.querySelectorAll('.interactive-question span');
    questions.forEach(q => {
        q.addEventListener('click', () => {
            questions.forEach(other => {
                if(other !== q) {
                    other.style.backgroundColor = 'transparent';
                    other.style.fontWeight = '500';
                }
            });
            q.style.backgroundColor = '#FCF3CF';
            q.style.fontWeight = '700';
            q.style.borderRadius = '4px';
        });
    });

    /* -----------------------------------------------------------
       ROUTING & PAGINATION (SPA Architecture)
    ----------------------------------------------------------- */
    const pages = document.querySelectorAll('.page');
    const navBtns = document.querySelectorAll('.nav-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const currentPageNum = document.getElementById('current-page-num');
    
    let currentPageIndex = 0;
    const pageIds = Array.from(pages).map(p => p.id);

    function navigateToPage(index) {
        if (index < 0 || index >= pageIds.length) return;
        
        // Hide all, un-active all
        pages.forEach(p => p.classList.remove('active'));
        navBtns.forEach(b => b.classList.remove('active'));
        
        // Show current
        pages[index].classList.add('active');
        navBtns[index].classList.add('active');
        
        currentPageIndex = index;
        currentPageNum.textContent = index + 1;
        
        // Update Buttons
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === pageIds.length - 1;
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    navBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            navigateToPage(index);
            // Close mobile sidebar if open
            if(window.innerWidth <= 768) {
                document.querySelector('.nav-links').classList.remove('show');
            }
        });
    });

    prevBtn.addEventListener('click', () => navigateToPage(currentPageIndex - 1));
    nextBtn.addEventListener('click', () => navigateToPage(currentPageIndex + 1));

    // Mobile sidebar toggle
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const navLinks = document.querySelector('.nav-links');
    if(toggleSidebarBtn && navLinks) {
        toggleSidebarBtn.addEventListener('click', () => {
            navLinks.classList.toggle('show');
        });
    }

    /* -----------------------------------------------------------
       LIVE SYNC (Firebase Realtime Database)
    ----------------------------------------------------------- */
    const TEACHER_EMAIL = "laotung400@gmail.com";
    const loginOverlay = document.getElementById('login-overlay');
    const mainApp = document.getElementById('main-app');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userEmailDisplay = document.getElementById('user-email-display');

    let firebaseListenersInitialized = false;

    // Handle Google Login
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            signInWithPopup(auth, provider).catch(err => {
                console.error("Login failed:", err);
                alert("Login failed. Please try again.");
            });
        });
    }

    // Handle Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth);
        });
    }

    // Listen to Auth State
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            if (loginOverlay) loginOverlay.style.display = 'none';
            if (mainApp) mainApp.style.display = 'flex';
            if (userEmailDisplay) userEmailDisplay.textContent = user.email;

            const isTeacher = (user.email === TEACHER_EMAIL);

            if (isTeacher && !document.title.startsWith("TEACHER VIEW")) {
                document.title = "TEACHER VIEW - " + document.title;
            }

            // Sync Logic
            const inputsToSave = document.querySelectorAll('input[type="text"], input[type="radio"], input[type="checkbox"], textarea');
            
            if (isTeacher) {
                inputsToSave.forEach(input => {
                    if(input.type === 'text' || input.tagName === 'TEXTAREA') {
                        input.style.backgroundColor = '#fff3cd'; // Highlight inputs in yellow
                    }
                });
            } else {
                inputsToSave.forEach(input => {
                    if(input.type === 'text' || input.tagName === 'TEXTAREA') {
                        input.style.backgroundColor = ''; 
                    }
                });
            }

            // Initialize Firebase sync only once per session
            if (!firebaseListenersInitialized) {
                firebaseListenersInitialized = true;
                
                // 1. Listen for live updates from Firebase
                const stateRef = ref(db, `handouts/${sessionId}`);
                onValue(stateRef, (snapshot) => {
                    const state = snapshot.val();
                    if (state) {
                        inputsToSave.forEach(input => {
                            const id = input.id || input.name + '-' + input.value;
                            if (!id || !state[id]) return;
                            
                            if (input.type === 'checkbox' || input.type === 'radio') {
                                input.checked = state[id].value;
                            } else {
                                input.value = state[id].value;
                            }
                        });
                    }
                });

                // 2. Emit updates when ANY user types
                inputsToSave.forEach(input => {
                    input.addEventListener('input', () => {
                        const id = input.id || input.name + '-' + input.value;
                        if (!id) return;

                        const val = (input.type === 'checkbox' || input.type === 'radio') ? input.checked : input.value;
                        
                        // Write to Firebase
                        set(ref(db, `handouts/${sessionId}/${id}`), {
                            value: val,
                            type: input.type
                        });
                    });
                });
            }
        } else {
            // User is signed out
            if (loginOverlay) loginOverlay.style.display = 'flex';
            if (mainApp) mainApp.style.display = 'none';
        }
    });
});
