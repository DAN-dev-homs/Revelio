// ============================================================
// REVELIO — About Page JavaScript
// ============================================================

// API Fetch Helper
async function apiFetch(endpoint, data = null) {
  const options = {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' }
  };
  if (data) options.body = JSON.stringify(data);
  
  const res = await fetch(`/api/about${endpoint}`, options);
  if (!res.ok) throw new Error('API Error');
  return res.json();
}

// Intersection Observer for Fade-up Animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, observerOptions);

// Initialize Animations
function initAnimations() {
  document.querySelectorAll('.fade-up').forEach(el => {
    fadeObserver.observe(el);
  });
}

// Load Statistics
async function loadStats() {
  try {
    const stats = await apiFetch('/stats');
    
    // Animate counters
    animateCounter('stat-users', stats.users);
    animateCounter('stat-books', stats.books);
  } catch (e) {
    console.error('Error loading stats:', e);
  }
}

// Animate Counter
function animateCounter(elementId, target) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const duration = 2000;
  const steps = 60;
  const increment = target / steps;
  let current = 0;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target;
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current);
    }
  }, duration / steps);
}

// Load Team Members
async function loadTeam() {
  try {
    const team = await apiFetch('/team');
    const teamGrid = document.getElementById('team-grid');
    
    if (team.length === 0) {
      teamGrid.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Aucun membre d\'équipe pour le moment.</p>';
      return;
    }
    
    teamGrid.innerHTML = team.map((member, index) => `
      <div class="team-member fade-up" style="transition-delay: ${index * 0.1}s">
        <div class="team-photo">
          ${member.photo_url ? `<img src="${member.photo_url}" alt="${member.name}">` : member.name[0]}
        </div>
        <h3>${member.name}</h3>
        <div class="role">${member.role}</div>
        ${member.bio ? `<div class="bio">${member.bio}</div>` : ''}
        ${(member.linkedin || member.twitter) ? `
          <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;">
            ${member.linkedin ? `<a href="${member.linkedin}" target="_blank" style="color: var(--text-muted); transition: color 0.3s;">LinkedIn</a>` : ''}
            ${member.twitter ? `<a href="${member.twitter}" target="_blank" style="color: var(--text-muted); transition: color 0.3s;">Twitter</a>` : ''}
          </div>
        ` : ''}
      </div>
    `).join('');
    
    // Re-initialize animations for new elements
    document.querySelectorAll('#team-grid .fade-up').forEach(el => {
      fadeObserver.observe(el);
    });
  } catch (e) {
    console.error('Error loading team:', e);
  }
}

// Load Partners
async function loadPartners() {
  try {
    const partners = await apiFetch('/partners');
    const carousel = document.getElementById('partners-carousel');
    
    if (partners.length === 0) {
      carousel.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Aucun partenaire pour le moment.</p>';
      return;
    }
    
    // Duplicate partners for infinite scroll effect
    const duplicatedPartners = [...partners, ...partners, ...partners];
    
    carousel.innerHTML = duplicatedPartners.map(partner => `
      <div class="partner-logo">
        <div class="partner-logo-img">
          ${partner.logo_url ? `<img src="${partner.logo_url}" alt="${partner.name}">` : `<span style="font-size: 24px; font-weight: 600; color: var(--accent-red);">${partner.name.charAt(0)}</span>`}
        </div>
        <span class="partner-logo-name">${partner.name}</span>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error loading partners:', e);
  }
}

// Contact Form Handler
function initContactForm() {
  const form = document.getElementById('contact-form');
  const successDiv = document.getElementById('form-success');
  
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('contact-name').value;
    const email = document.getElementById('contact-email').value;
    const message = document.getElementById('contact-message').value;
    
    try {
      await apiFetch('/contact', { name, email, message });
      
      // Show success message
      successDiv.style.display = 'block';
      form.reset();
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        successDiv.style.display = 'none';
      }, 3000);
    } catch (e) {
      console.error('Error sending message:', e);
      alert('Erreur lors de l\'envoi du message. Veuillez réessayer.');
    }
  });
}

// Smooth Scroll
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Initialize Everything
document.addEventListener('DOMContentLoaded', () => {
  initAnimations();
  loadStats();
  loadTeam();
  loadPartners();
  initContactForm();
  initSmoothScroll();
});
