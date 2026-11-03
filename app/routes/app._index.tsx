import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import styles from "../styles/dashboard.module.css";

const VIGOUR_DEFAULT_SERVICES = [
  {
    name: "Релакс масажа - Цело тело",
    description: "Нежни и флуидни движења за ослободување од стрес, подобра циркулација и релаксација.",
    price: 1300.0,
    duration: 60,
  },
  {
    name: "Спортска масажа - Цело тело",
    description: "Длабоко-ткивен притисок, истегнување и таргетирање на мускулните јазли.",
    price: 1500.0,
    duration: 60,
  },
  {
    name: "Релакс масажа - Грб",
    description: "Фокусиран третман на грбот, рамениот појас и вратот за олеснување на затегнатоста.",
    price: 800.0,
    duration: 45,
  },
  {
    name: "Спортска масажа - Грб",
    description: "Интензивна терапија за 'рбетниот столб, лопатките и трапезите.",
    price: 1000.0,
    duration: 45,
  },
  {
    name: "Масажа на стапала (Рефлексологија)",
    description: "Стимулација на акупресурните точки за олеснување на тежината во нозете.",
    price: 500.0,
    duration: 45,
  },
  {
    name: "Премиум масажа - Цело тело напред и назад",
    description: "Комплетен масажен ритуал напред и назад со длабинска регенерација.",
    price: 2500.0,
    duration: 75,
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Ensure Vigour services exist
  let services = await prisma.service.findMany({
    where: { shop },
    orderBy: { price: "asc" },
  });

  if (services.length === 0) {
    await prisma.service.createMany({
      data: VIGOUR_DEFAULT_SERVICES.map((s) => ({
        shop,
        ...s,
      })),
    });

    services = await prisma.service.findMany({
      where: { shop },
      orderBy: { price: "asc" },
    });
  }

  // Check Google Calendar Connection
  const googleAuth = await prisma.googleAuth.findUnique({
    where: { shop },
  });

  // Fetch appointments
  const appointments = await prisma.appointment.findMany({
    where: { shop },
    include: { service: true },
    orderBy: { startTime: "desc" },
  });

  // Calculate statistics
  const totalBookings = appointments.length;
  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
  const completedCount = appointments.filter((a) => a.status === "completed").length;
  const totalRevenue = appointments
    .filter((a) => a.status !== "cancelled")
    .reduce((sum, a) => sum + (a.service?.price || 0), 0);

  return {
    shop,
    services,
    appointments,
    isGoogleConnected: !!googleAuth,
    metrics: {
      totalBookings,
      confirmedCount,
      completedCount,
      totalRevenue,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update_status") {
    const appointmentId = formData.get("appointmentId") as string;
    const newStatus = formData.get("status") as string;

    if (appointmentId && newStatus) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: newStatus },
      });
      return { success: true, message: `Статусот е променет во: ${newStatus}` };
    }
  }

  if (intent === "delete_appointment") {
    const appointmentId = formData.get("appointmentId") as string;
    if (appointmentId) {
      await prisma.appointment.delete({
        where: { id: appointmentId },
      });
      return { success: true, message: "Терминот е избришан" };
    }
  }

  if (intent === "create_service") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const price = parseFloat(formData.get("price") as string) || 0;
    const duration = parseInt(formData.get("duration") as string, 10) || 60;

    if (name && price > 0) {
      await prisma.service.create({
        data: {
          shop,
          name,
          description: description || null,
          price,
          duration,
        },
      });
      return { success: true, message: `Третманот "${name}" е успешно додаден` };
    }
  }

  return { success: false, error: "Невалидна акција" };
};

export default function VigourDashboard() {
  const { shop, services, appointments, isGoogleConnected, metrics } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success?: boolean; message?: string }>();
  const shopify = useAppBridge();
  const [activeTab, setActiveTab] = useState<"appointments" | "services" | "google" | "blocks">("appointments");
  const [showNewServiceModal, setShowNewServiceModal] = useState(false);

  useEffect(() => {
    if (fetcher.data?.message && shopify) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  const handleStatusChange = (appointmentId: string, status: string) => {
    fetcher.submit(
      { intent: "update_status", appointmentId, status },
      { method: "POST" }
    );
  };

  const handleDelete = (appointmentId: string) => {
    if (confirm("Дали сте сигурни дека сакате да го избришете овој термин?")) {
      fetcher.submit(
        { intent: "delete_appointment", appointmentId },
        { method: "POST" }
      );
    }
  };

  const formatMKD = (amount: number) => {
    return `${Math.round(amount).toLocaleString()} ден.`;
  };

  return (
    <s-page heading="Vigour Massage Studio — Контролна Табла">
      <div className={styles.dashboardContainer}>
        
        {/* Google Calendar Status Callout */}
        <div style={{
          background: isGoogleConnected ? "#E8F5E9" : "#FFF8E1",
          border: `1px solid ${isGoogleConnected ? "#81C784" : "#FFE082"}`,
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.2rem" }}>{isGoogleConnected ? "📅" : "⚠️"}</span>
            <div>
              <strong>Google Calendar Синхронизација:</strong>{" "}
              {isGoogleConnected ? (
                <span style={{ color: "#2E7D32", fontWeight: 700 }}>Поврзано (Двонасочна синхронизација активна)</span>
              ) : (
                <span style={{ color: "#F57F17", fontWeight: 600 }}>Не е поврзано. Поврзете го вашиот Google профил за автоматско впишување на резервациите.</span>
              )}
            </div>
          </div>
          <a
            href={`/api/google-auth?shop=${encodeURIComponent(shop)}`}
            style={{
              padding: "8px 18px",
              background: isGoogleConnected ? "#2E7D32" : "#243F3A",
              color: "#fff",
              borderRadius: "20px",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.88rem"
            }}
          >
            {isGoogleConnected ? "Ре-авторизирај Календар" : "Поврзи Google Calendar"}
          </a>
        </div>

        {/* Top Metrics Grid */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Вкупно Резервации</div>
            <div className={styles.metricValue}>{metrics.totalBookings}</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Активни Термини</div>
            <div className={styles.metricValue} style={{ color: "#108043" }}>
              {metrics.confirmedCount}
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Завршени Сесии</div>
            <div className={styles.metricValue} style={{ color: "#0369a1" }}>
              {metrics.completedCount}
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Проценета Заработувачка</div>
            <div className={styles.metricValue} style={{ color: "#b88a44" }}>
              {formatMKD(metrics.totalRevenue)}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className={styles.tabsBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === "appointments" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("appointments")}
          >
            Термини & Резервации ({appointments.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "services" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("services")}
          >
            Третмани & Ценовник ({services.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "google" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("google")}
          >
            Google Calendar
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "blocks" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("blocks")}
          >
            Тема Блокови (App Blocks)
          </button>
        </div>

        {/* Tab 1: Appointments Table */}
        {activeTab === "appointments" && (
          <div className={styles.tableWrapper}>
            {appointments.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Нема нови резервации во моментов.</p>
                <p style={{ fontSize: "13px", marginTop: "8px" }}>
                  Клиентите кои ќе направат резервација преку вашиот веб-сајт ќе се појават тука автоматски.
                </p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Третман</th>
                    <th>Датум & Час</th>
                    <th>Контакт</th>
                    <th>Google Cal</th>
                    <th>Статус</th>
                    <th>Акции</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((app) => {
                    const start = new Date(app.startTime);
                    const formattedDate = start.toLocaleDateString("mk-MK", {
                      timeZone: "Europe/Skopje",
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                    const formattedTime = start.toLocaleTimeString("mk-MK", {
                      timeZone: "Europe/Skopje",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    let badgeClass = styles.badgeConfirmed;
                    if (app.status === "completed") badgeClass = styles.badgeCompleted;
                    if (app.status === "cancelled") badgeClass = styles.badgeCancelled;

                    return (
                      <tr key={app.id}>
                        <td>
                          <strong>{app.customerName}</strong>
                          {app.notes && (
                            <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                              Напомена: {app.notes}
                            </div>
                          )}
                        </td>
                        <td>
                          {app.service?.name || "Масажен третман"}
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            {formatMKD(app.service?.price || 0)} ({app.service?.duration} мин)
                          </div>
                        </td>
                        <td>
                          {formattedDate}
                          <div style={{ fontSize: "12px", color: "#666" }}>{formattedTime} часот</div>
                        </td>
                        <td>
                          <div>{app.customerEmail}</div>
                          {app.customerPhone && (
                            <div style={{ fontSize: "12px", color: "#666" }}>{app.customerPhone}</div>
                          )}
                        </td>
                        <td>
                          {app.googleEventId ? (
                            <span style={{ color: "#2E7D32", fontSize: "12px", fontWeight: 700 }}>✓ Синхронизиран</span>
                          ) : (
                            <span style={{ color: "#9E9E9E", fontSize: "12px" }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`${styles.badge} ${badgeClass}`}>
                            {app.status === "confirmed" ? "Потврдено" : app.status === "completed" ? "Завршено" : "Откажано"}
                          </span>
                        </td>
                        <td>
                          {app.status === "confirmed" && (
                            <>
                              <button
                                className={`${styles.actionBtn} ${styles.btnComplete}`}
                                onClick={() => handleStatusChange(app.id, "completed")}
                              >
                                Заврши
                              </button>
                              <button
                                className={`${styles.actionBtn} ${styles.btnCancel}`}
                                onClick={() => handleStatusChange(app.id, "cancelled")}
                              >
                                Откажи
                              </button>
                            </>
                          )}
                          {app.status !== "confirmed" && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleDelete(app.id)}
                            >
                              Избриши
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Services & Pricing */}
        {activeTab === "services" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px" }}>Актуелни Третмани во Vigour</h3>
              <button
                className={styles.actionBtn}
                style={{ background: "#243F3A", color: "#fff", borderColor: "#243F3A", padding: "8px 16px" }}
                onClick={() => setShowNewServiceModal(!showNewServiceModal)}
              >
                {showNewServiceModal ? "Затвори Форма" : "+ Додади Нов Третман"}
              </button>
            </div>

            {showNewServiceModal && (
              <fetcher.Form method="post" style={{ background: "#fff", border: "1px solid #e1e3e5", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
                <input type="hidden" name="intent" value="create_service" />
                <h4 style={{ margin: "0 0 14px 0" }}>Додади Нов Масажен Третман</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Име на третман *</label>
                    <input type="text" name="name" required placeholder="на пр. Лимфна дренажа" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Времетраење (минути) *</label>
                    <input type="number" name="duration" defaultValue={60} required style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Цена (ден.) *</label>
                    <input type="number" step="1" name="price" required placeholder="1200" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Краток опис</label>
                    <input type="text" name="description" placeholder="Придобивки од третманот" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                  </div>
                </div>
                <button type="submit" className={styles.actionBtn} style={{ background: "#243F3A", color: "#fff", borderColor: "#243F3A", padding: "8px 18px" }}>
                  Зачувај Третман
                </button>
              </fetcher.Form>
            )}

            <div className={styles.servicesGrid}>
              {services.map((service) => (
                <div key={service.id} className={styles.serviceCard}>
                  <div className={styles.serviceTitle}>{service.name}</div>
                  <div className={styles.serviceDesc}>{service.description || "Нема додатен опис."}</div>
                  <div className={styles.serviceDetails}>
                    <span className={styles.servicePrice}>{formatMKD(service.price)}</span>
                    <span className={styles.serviceDuration}>{service.duration} мин</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Google Calendar Synchronization */}
        {activeTab === "google" && (
          <div style={{ background: "#fff", borderRadius: "14px", padding: "32px", border: "1px solid #E0DED8" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#243F3A" }}>Google Calendar Двонасочна Синхронизација</h3>
            <p style={{ color: "#555", lineHeight: 1.6, marginBottom: "24px" }}>
              Со поврзувањето на вашиот Google календар, системот автоматски ги чита вашите приватни обврски (за да не дозволи преклопување на термини), и секоја нова резервација од сајтот директно ја запишува во вашиот календар.
            </p>

            <div style={{ padding: "20px", background: "#F7F4F0", borderRadius: "10px", marginBottom: "24px" }}>
              <div style={{ fontWeight: 700, marginBottom: "8px", color: "#243F3A" }}>Како функционира:</div>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#444", lineHeight: 1.6 }}>
                <li><strong>Читање слободни термини:</strong> Кога клиент избира датум на веб-сајтот, системот го проверува Google Calendar на Дарко и ги отстранува зафатените часови.</li>
                <li><strong>Запишување резервации:</strong> Веднаш штом клиентот резервира термин, истиот се појавува во вашиот Google Calendar со името на клиентот, телефонот и избраната масажа.</li>
              </ul>
            </div>

            <a
              href={`/api/google-auth?shop=${encodeURIComponent(shop)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 24px",
                background: "#243F3A",
                color: "#fff",
                borderRadius: "30px",
                textDecoration: "none",
                fontWeight: 700
              }}
            >
              <span>{isGoogleConnected ? "✓ Ре-авторизирај Google Calendar" : "Поврзи Google Calendar"}</span>
            </a>
          </div>
        )}

        {/* Tab 4: Theme Blocks Guide */}
        {activeTab === "blocks" && (
          <div className={styles.guideBox}>
            <h3 style={{ margin: "0 0 16px 0", color: "#243F3A" }}>
              Како да ги додадете Vigour блоковите во вашиот Shopify сајт
            </h3>
            <p style={{ color: "#555", lineHeight: 1.6, marginBottom: "24px" }}>
              Сите 12 секции на сајтот се изградени како нативни Shopify Theme App Extension блокови. Можете да ги влечете (drag-and-drop), преместувате и уредувате во Theme Editor без код.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", marginBottom: "32px" }}>
              <div style={{ padding: "16px", background: "#F7F4F0", borderRadius: "8px", border: "1px solid #E0DED8" }}>
                <strong>1. Vigour Hero Banner</strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#666" }}>Главен наслов со жива картичка за следен слободен термин.</p>
              </div>
              <div style={{ padding: "16px", background: "#F7F4F0", borderRadius: "8px", border: "1px solid #E0DED8" }}>
                <strong>2. Vigour Мапа на Болка</strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#666" }}>Интерактивна анатомија со 7 зони и GA4 маркетинг сигнали.</p>
              </div>
              <div style={{ padding: "16px", background: "#F7F4F0", borderRadius: "8px", border: "1px solid #E0DED8" }}>
                <strong>3. Vigour Services Grid</strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#666" }}>Ценовник со релакс, спортски третмани и видео прегледи.</p>
              </div>
              <div style={{ padding: "16px", background: "#F7F4F0", borderRadius: "8px", border: "1px solid #E0DED8" }}>
                <strong>4. Vigour За Дарко</strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#666" }}>Биографија, фотографија и филозофија на основачот.</p>
              </div>
              <div style={{ padding: "16px", background: "#F7F4F0", borderRadius: "8px", border: "1px solid #E0DED8" }}>
                <strong>5. Vigour Како Функционира</strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#666" }}>3 чекори: Избери третман → Резервирај → Дојди и уживај.</p>
              </div>
              <div style={{ padding: "16px", background: "#F7F4F0", borderRadius: "8px", border: "1px solid #E0DED8" }}>
                <strong>6. Vigour Видео Програми</strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#666" }}>Програми со вежби за закрепнување со YouTube плеер.</p>
              </div>
              <div style={{ padding: "16px", background: "#F7F4F0", borderRadius: "8px", border: "1px solid #E0DED8" }}>
                <strong>7. Vigour Рецензии</strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#666" }}>Слајдер со искрени впечатоци на задоволни клиенти.</p>
              </div>
              <div style={{ padding: "16px", background: "#F7F4F0", borderRadius: "8px", border: "1px solid #E0DED8" }}>
                <strong>8. Vigour Контакт & Локација</strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#666" }}>Viber-first копче, телефон, инстаграм и Google мапа.</p>
              </div>
              <div style={{ padding: "16px", background: "#F7F4F0", borderRadius: "8px", border: "1px solid #E0DED8" }}>
                <strong>9. Vigour Пакети & Ваучери</strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#666" }}>Информативен приказ на пакети од 5/10 сесии и ваучери.</p>
              </div>
              <div style={{ padding: "16px", background: "#F7F4F0", borderRadius: "8px", border: "1px solid #E0DED8" }}>
                <strong>10. Vigour Форма за Резервација</strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#666" }}>Комплетен календарски систем поврзан со Google Calendar.</p>
              </div>
            </div>

            <div style={{ padding: "16px", background: "#E8F5E9", borderRadius: "8px" }}>
              <strong>Чекор за активација во Shopify:</strong>
              <p style={{ margin: "6px 0 0 0", fontSize: "14px", color: "#2E7D32" }}>
                Одете во <strong>Online Store &gt; Themes &gt; Customize</strong>. Кликнете на <strong>Add section</strong> или <strong>Add block</strong>, изберете го табот <strong>Apps</strong> и додајте ги блоковите според посакуваниот редослед на почетната страна!
              </p>
            </div>
          </div>
        )}
      </div>
    </s-page>
  );
}
