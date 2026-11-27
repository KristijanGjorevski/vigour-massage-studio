/**
 * Vigour Massage Studio — Booking Widget JavaScript
 * Localized for Macedonia (ден.), supports event/URL pre-fill, slot selection & instant confirmation
 */
(function () {
  'use strict';

  // Texts written by the block (booking_form.liquid) in the language of the page
  function readTexts(container) {
    const el = document.getElementById('vm-booking-i18n-' + container.dataset.blockId);
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return {};
    }
  }

  function initBookingWidgets() {
    const containers = document.querySelectorAll(".najdo-booking-container");

    containers.forEach((container) => {
      if (container.dataset.initialized) return;
      container.dataset.initialized = "true";

      // Storefront → app via the Shopify App Proxy. Shopify signs each request and
      // adds the shop server-side, so the client never sends (or can spoof) it.
      const apiBase = container.dataset.apiBase || "/apps/vigour";
      const t = readTexts(container); // price / minutes / retry from the page; the rest is loaded from assets/booking-texts-<lang>.json
      const textsReady = container.dataset.textsUrl
        ? fetch(container.dataset.textsUrl).then((res) => res.json()).then((extra) => Object.assign(t, extra)).catch(() => {})
        : Promise.resolve();

      // 1300 -> "1.300 ден." (Macedonian) or "1,300 MKD" (English): separator and currency come from the locale files
      function formatPrice(amount) {
        const sep = t.thousandsSeparator || ".";
        const digits = Math.round(amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
        return (t.price || "[amount]").replace("[amount]", digits);
      }

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
      // Links from other pages (hero slot card, pain map) arrive as ?service=…&date=…&time=…
      // Applied once, after the first load, so "new booking" starts clean.
      let urlPrefillDone = false;
      function checkUrlPreFill() {
        if (urlPrefillDone) return;
        urlPrefillDone = true;
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const serviceParam = urlParams.get('service') || urlParams.get('serviceId');
          const dateParam = urlParams.get('date');
          const timeParam = urlParams.get('time');

          if (serviceParam && serviceSelect) {
            selectServiceByNameOrId(serviceParam);
          }

          if (dateParam && timeParam) {
            prefillSlot(dateParam, timeParam);
          } else if (dateParam && dateInput) {
            dateInput.value = dateParam;
            fetchSlotsForDate(dateParam);
          } else if (serviceParam && dateInput && dateInput.value) {
            // A longer treatment may not fit every slot: refresh the day's availability
            fetchSlotsForDate(dateInput.value);
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
                  ${s.name} — ${formatPrice(s.price)} (${t.minutes.replace("[number]", s.duration)})
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
          slotsContainer.innerHTML = `<div class="najdo-slots-empty">${t.slotsChecking}</div>`;
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
            <span>${t.slotsFailed}</span>
            <button type="button" class="najdo-slots-retry">${t.retry}</button>
          </div>`;
          slotsContainer.querySelector(".najdo-slots-retry").addEventListener("click", () => fetchSlotsForDate(date));
        }
      }

      function renderSlots(slots) {
        if (!slotsContainer) return;
        if (!slots || slots.length === 0) {
          slotsContainer.innerHTML = `<div class="najdo-slots-empty">${t.slotsNone}</div>`;
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

      // Pre-select a date and time: from the URL, or from the hero's card when the form is on the same page
      async function prefillSlot(date, time) {
        if (!date || !time || !dateInput || (unavailableBox && !unavailableBox.hidden)) return;
        dateInput.value = date;
        await fetchSlotsForDate(date);
        const wanted = Array.from(slotsContainer.querySelectorAll(".najdo-slot-btn")).find((b) => b.dataset.slot === time);
        if (wanted) wanted.click();
      }

      window.addEventListener('vigour:prefill-slot', (e) => {
        const { date, time } = (e.detail || {});
        prefillSlot(date, time);
      });

      // Handle form submission
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          showError(null);

          if (!selectedSlotInput || !selectedSlotInput.value) {
            showError(t.errorPickSlot);
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
              throw new Error(result.error || t.errorFailed);
            }

            // Show confirmation
            form.style.display = "none";
            if (successBox) successBox.style.display = "block";

            const chosenServiceName =
              serviceSelect && serviceSelect.selectedIndex >= 0
                ? serviceSelect.options[serviceSelect.selectedIndex]?.text
                : t.defaultService;

            if (receiptBox) {
              receiptBox.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px; line-height:1.5;">
                  <div><strong>${t.receiptClient}</strong> ${formData.customerName}</div>
                  <div><strong>${t.receiptService}</strong> ${chosenServiceName}</div>
                  <div><strong>${t.receiptDatetime}</strong> ${t.receiptDatetimeValue.replace("[date]", formData.date).replace("[time]", formData.timeSlot)}</div>
                  <div><strong>${t.receiptEmail}</strong> ${formData.customerEmail}</div>
                  ${formData.customerPhone ? `<div><strong>${t.receiptPhone}</strong> ${formData.customerPhone}</div>` : ""}
                  <div><strong>${t.receiptStatus}</strong> <span style="color: #2E7D32; font-weight: 700;">${t.receiptConfirmed}</span></div>
                  <div style="margin-top:12px; padding:10px 14px; background: rgba(46,125,50,0.1); border-radius:8px; font-size:14.08px; color:#1B5E20;">
                    ${t.receiptReminder}
                  </div>
                </div>
              `;
            }
          } catch (err) {
            console.error("Booking error:", err);
            showError(err.message || t.errorUnexpected);
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

      textsReady.then(loadServicesAndSlots);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBookingWidgets);
  } else {
    initBookingWidgets();
  }
})();
