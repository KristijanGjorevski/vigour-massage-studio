/**
 * Vigour Massage Studio — Booking Widget JavaScript
 * Localized for Macedonia (ден.), supports event/URL pre-fill, slot selection & instant confirmation
 */
(function () {
  'use strict';

  function formatPriceMKD(amount) {
    if (!amount) return '0 ден.';
    // Macedonian thousand separator dot e.g. 1.300 ден.
    return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ден.`;
  }

  function initBookingWidgets() {
    const containers = document.querySelectorAll(".najdo-booking-container");

    containers.forEach((container) => {
      if (container.dataset.initialized) return;
      container.dataset.initialized = "true";

      // Storefront → app via the Shopify App Proxy. Shopify signs each request and
      // adds the shop server-side, so the client never sends (or can spoof) it.
      const apiBase = container.dataset.apiBase || "/apps/vigour";

      const form = container.querySelector(".najdo-form");
      const serviceSelect = container.querySelector('select[name="serviceId"]');
      const serviceMeta = container.querySelector(".najdo-service-meta");
      const dateInput = container.querySelector('input[name="date"]');
      const slotsContainer = container.querySelector(".najdo-slots-grid");
      const selectedSlotInput = container.querySelector('input[name="timeSlot"]');
      const submitBtn = container.querySelector(".najdo-submit-btn");
      const btnText = submitBtn ? submitBtn.querySelector(".btn-text") : null;
      const btnSpinner = submitBtn ? submitBtn.querySelector(".btn-spinner") : null;
      const errorBox = container.querySelector(".najdo-alert-error");
      const successBox = container.querySelector(".najdo-success-box");
      const receiptBox = container.querySelector(".najdo-receipt-details");
      const newBookingBtn = container.querySelector(".najdo-btn-secondary");
      const unavailableBox = container.querySelector(".najdo-unavailable");
      const retryBtn = container.querySelector(".najdo-retry-btn");

      let servicesList = [];

      // Set min date to today (studio local date, not UTC)
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Skopje" }).format(new Date());
      if (dateInput) {
        dateInput.min = today;
        dateInput.value = today;
      }

      function showError(msg) {
        if (!errorBox) return;
        if (!msg) {
          errorBox.style.display = "none";
          errorBox.textContent = "";
        } else {
          errorBox.style.display = "block";
          errorBox.textContent = msg;
        }
      }

      function setLoading(isLoading) {
        if (!submitBtn) return;
        submitBtn.disabled = isLoading;
        if (btnSpinner) btnSpinner.style.display = isLoading ? "inline-block" : "none";
        if (btnText) btnText.style.opacity = isLoading ? "0.6" : "1";
      }

      // Check URL parameters for pre-fill
      function checkUrlPreFill() {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const serviceParam = urlParams.get('service') || urlParams.get('serviceId');
          const dateParam = urlParams.get('date');
          const timeParam = urlParams.get('time');

          if (dateParam && dateInput) {
            dateInput.value = dateParam;
          }

          if (serviceParam && serviceSelect) {
            selectServiceByNameOrId(serviceParam);
          }

          if (timeParam && selectedSlotInput) {
            selectedSlotInput.value = timeParam;
          }
        } catch (e) {
          console.warn("Could not parse URL prefill params", e);
        }
      }

      function selectServiceByNameOrId(term) {
        if (!serviceSelect || !term) return;
        const lowerTerm = term.toLowerCase();
        for (let i = 0; i < serviceSelect.options.length; i++) {
          const opt = serviceSelect.options[i];
          if (opt.value === term || opt.text.toLowerCase().includes(lowerTerm)) {
            serviceSelect.selectedIndex = i;
            updateServiceMeta();
            break;
          }
        }
      }

      // When the calendar can't be reached the form is replaced by a message with Retry,
      // Viber and phone. It never shows services or times that were not loaded from the calendar.
      function showUnavailable(isUnavailable) {
        if (unavailableBox) unavailableBox.hidden = !isUnavailable;
        if (form) form.style.display = isUnavailable ? "none" : "block";
      }

      // Fetch services & initial slots
      async function loadServicesAndSlots() {
        try {
          const endpoint = `${apiBase}/bookings?date=${dateInput.value}`;
          const res = await fetch(endpoint, {
            headers: { Accept: "application/json" },
          });

          if (!res.ok) throw new Error("Could not connect to booking server");
          const data = await res.json();
          if (!data.services || data.services.length === 0) throw new Error("No services returned");

          servicesList = data.services;
          serviceSelect.innerHTML = servicesList
            .map(
              (s, i) =>
                `<option value="${s.id}" ${i === 0 ? "selected" : ""}>
                  ${s.name} — ${formatPriceMKD(s.price)} (${s.duration} мин)
                </option>`
            )
            .join("");

          updateServiceMeta();
          showUnavailable(false);
          renderSlots(data.availableSlots || []);
          checkUrlPreFill();
        } catch (err) {
          console.warn("Vigour booking: calendar not reachable", err);
          showUnavailable(true);
        }
      }

      function updateServiceMeta() {
        if (!serviceMeta || !serviceSelect) return;
        const selectedId = serviceSelect.value;
        const currentService = servicesList.find((s) => s.id === selectedId);
        if (currentService && currentService.description) {
          serviceMeta.textContent = currentService.description;
        } else {
          serviceMeta.textContent = "";
        }
      }

      async function fetchSlotsForDate(date) {
        if (slotsContainer) {
          slotsContainer.innerHTML = `<div class="najdo-slots-empty">Проверка на слободни термини...</div>`;
        }
        if (selectedSlotInput) selectedSlotInput.value = "";

        try {
          const serviceParam = serviceSelect && serviceSelect.value ? `&serviceId=${encodeURIComponent(serviceSelect.value)}` : "";
          const endpoint = `${apiBase}/bookings?date=${date}${serviceParam}`;
          const res = await fetch(endpoint, { headers: { Accept: "application/json" } });
          if (!res.ok) throw new Error("Could not load slots");
          const data = await res.json();
          renderSlots(data.availableSlots || []);
        } catch (err) {
          console.warn("Vigour booking: could not load slots", err);
          if (!slotsContainer) return;
          slotsContainer.innerHTML = `<div class="najdo-slots-empty najdo-slots-failed">
            <span>Не можевме да ги вчитаме термините.</span>
            <button type="button" class="najdo-slots-retry">Обиди се повторно</button>
          </div>`;
          slotsContainer.querySelector(".najdo-slots-retry").addEventListener("click", () => fetchSlotsForDate(date));
        }
      }

      function renderSlots(slots) {
        if (!slotsContainer) return;
        if (!slots || slots.length === 0) {
          slotsContainer.innerHTML = `<div class="najdo-slots-empty">Нема слободни термини за овој датум. Ве молиме изберете друг ден.</div>`;
          return;
        }

        slotsContainer.innerHTML = slots
          .map(
            (slot) =>
              `<button type="button" class="najdo-slot-btn" data-slot="${slot}">${slot}</button>`
          )
          .join("");

        slotsContainer.querySelectorAll(".najdo-slot-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            slotsContainer.querySelectorAll(".najdo-slot-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            if (selectedSlotInput) selectedSlotInput.value = btn.dataset.slot;
            showError(null);
          });
        });
      }

      if (serviceSelect) {
        serviceSelect.addEventListener("change", () => {
          updateServiceMeta();
          // Longer treatments may not fit every slot — refresh availability
          if (dateInput && dateInput.value) fetchSlotsForDate(dateInput.value);
        });
      }

      if (dateInput) {
        dateInput.addEventListener("change", (e) => {
          if (e.target.value) {
            fetchSlotsForDate(e.target.value);
          }
        });
      }

      // Listen for custom event from services grid or pain map
      window.addEventListener('vigour:select-service', (e) => {
        if (e.detail && e.detail.serviceName) {
          selectServiceByNameOrId(e.detail.serviceName);
        }
      });

      // Handle form submission
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          showError(null);

          if (!selectedSlotInput || !selectedSlotInput.value) {
            showError("Ве молиме изберете слободен термин од понудените часови.");
            return;
          }

          setLoading(true);

          const customerNameInput = form.querySelector('input[name="customerName"]');
          const customerEmailInput = form.querySelector('input[name="customerEmail"]');
          const customerPhoneInput = form.querySelector('input[name="customerPhone"]');
          const notesInput = form.querySelector('textarea[name="notes"]');

          const formData = {
            serviceId: serviceSelect ? serviceSelect.value : '',
            customerName: customerNameInput ? customerNameInput.value.trim() : '',
            customerEmail: customerEmailInput ? customerEmailInput.value.trim() : '',
            customerPhone: customerPhoneInput ? customerPhoneInput.value.trim() : '',
            notes: notesInput ? notesInput.value.trim() : '',
            date: dateInput ? dateInput.value : '',
            timeSlot: selectedSlotInput.value,
          };

          try {
            const endpoint = `${apiBase}/bookings`;
            const res = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(formData),
            });

            const result = await res.json();

            if (!res.ok) {
              throw new Error(result.error || "Неуспешна резервација. Терминот можеби е веќе зафатен.");
            }

            // Show confirmation
            form.style.display = "none";
            if (successBox) successBox.style.display = "block";

            const chosenServiceName =
              serviceSelect && serviceSelect.selectedIndex >= 0
                ? serviceSelect.options[serviceSelect.selectedIndex]?.text
                : "Масажен третман";

            if (receiptBox) {
              receiptBox.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px; line-height:1.5;">
                  <div><strong>Клиент:</strong> ${formData.customerName}</div>
                  <div><strong>Третман:</strong> ${chosenServiceName}</div>
                  <div><strong>Датум & Термин:</strong> ${formData.date} во ${formData.timeSlot} часот</div>
                  <div><strong>Контакт е-пошта:</strong> ${formData.customerEmail}</div>
                  ${formData.customerPhone ? `<div><strong>Телефон:</strong> ${formData.customerPhone}</div>` : ""}
                  <div><strong>Статус:</strong> <span style="color: #2E7D32; font-weight: 700;">✓ Успешно потврдено</span></div>
                  <div style="margin-top:12px; padding:10px 14px; background: rgba(46,125,50,0.1); border-radius:8px; font-size:14.08px; color:#1B5E20;">
                    💳 <strong>Потсетник:</strong> Добивате 5% попуст при плаќање со картичка во студиото!
                  </div>
                </div>
              `;
            }
          } catch (err) {
            console.error("Booking error:", err);
            showError(err.message || "Настана неочекувана грешка. Ве молиме обидете се повторно или контактирајте не на Viber.");
          } finally {
            setLoading(false);
          }
        });
      }

      if (newBookingBtn) {
        newBookingBtn.addEventListener("click", () => {
          if (form) form.reset();
          if (selectedSlotInput) selectedSlotInput.value = "";
          if (dateInput) dateInput.value = today;
          if (successBox) successBox.style.display = "none";
          if (form) form.style.display = "block";
          loadServicesAndSlots();
        });
      }

      if (retryBtn) {
        retryBtn.addEventListener("click", async () => {
          retryBtn.disabled = true;
          await loadServicesAndSlots();
          retryBtn.disabled = false;
        });
      }

      loadServicesAndSlots();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBookingWidgets);
  } else {
    initBookingWidgets();
  }
})();
