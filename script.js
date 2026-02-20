// Your live Google Apps Script Web App URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw0x9hO0teM2nQq3b_2uxnlh1mV6oohUXpTs46oZ7_LU0a_e_5PbHlajZj9EFUSjis/exec'; 

const modal = document.getElementById("feedbackModal");
const btn = document.getElementById("feedbackBtn");
const close = document.querySelector(".close-btn");
const form = document.getElementById("feedbackForm");
const successMsg = document.getElementById("successMessage");
const submitBtn = document.getElementById("submitBtn");

const stars = document.querySelectorAll(".star");
const ratingInput = document.getElementById("ratingValue");

// Star Rating Logic
stars.forEach((star, index) => {
  star.addEventListener("click", () => {
    ratingInput.value = index + 1;
    stars.forEach((s, i) => {
      if (i <= index) {
        s.classList.add("active");
      } else {
        s.classList.remove("active");
      }
    });
  });
});

// Modal Open/Close Logic
btn.onclick = () => modal.style.display = "block";
close.onclick = () => modal.style.display = "none";
window.onclick = (event) => {
  if (event.target == modal) modal.style.display = "none";
}

// Form Submission Logic
form.onsubmit = (e) => {
  e.preventDefault();
  
  submitBtn.disabled = true;
  submitBtn.innerText = "Sending Feedback...";

  const formData = new FormData(form);
  // Secretly capture the user's browser details for debugging
  formData.append('userAgent', navigator.userAgent);

  fetch(SCRIPT_URL, { method: 'POST', body: formData })
    .then(response => {
      form.style.display = "none";
      successMsg.style.display = "block";
    })
    .catch(error => {
      console.error('Error:', error);
      alert("There was an issue sending your feedback. Please try again.");
    })
    .finally(() => {
      // Reset the form after 3.5 seconds
      setTimeout(() => {
        modal.style.display = "none";
        form.style.display = "block";
        successMsg.style.display = "none";
        submitBtn.disabled = false;
        submitBtn.innerText = "Send Feedback";
        form.reset();
        
        // Reset stars to 5
        ratingInput.value = 5;
        stars.forEach(s => s.classList.add("active"));
      }, 3500);
    });
};
