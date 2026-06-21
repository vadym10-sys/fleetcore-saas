# FleetCore Product, UX, UI, Frontend, Mobile and SaaS Audit

Дата: 2026-06-21

Цель: довести FleetCore до уровня B2B SaaS, который можно уверенно продавать за EUR 199-999 в месяц. Этот документ фиксирует не косметику, а продуктовые, UX, UI, frontend, mobile, SaaS, security и commercial gaps.

## Executive Summary

FleetCore уже имеет сильную основу: B2B авторизация, tenant isolation, автомобили, клиенты, аренды, документы, финансы, GPS, onboarding, роли owner/manager, клиентская intake-ссылка и публичный деплой. Но продукт пока ощущается как мощный прототип: много возможностей, мало иерархии, слишком много действий рядом, большие монолитные файлы, неполный профессиональный слой таблиц/фильтров/массовых действий, перегруженные рабочие экраны.

Главная стратегия: оставить только ежедневные рабочие сценарии на первом уровне, а все редкие действия увести в контекстные меню, мастеры и detail pages. На мобильном интерфейс должен быть рабочим приложением, а не уменьшенной desktop-панелью.

## 1. Information Architecture

Текущее меню: Dashboard, GPS, Vehicles, Drivers/Clients, Bookings, Finance, Service, Settings.

Что хорошо:
- Основные домены бизнеса покрыты.
- Меню уже сокращено до разумного количества разделов.
- Роли owner/manager соответствуют MVP.

Проблемы:
- `Service` фактически используется как документы/сервисный центр, в русском интерфейсе это может путать.
- Dashboard, Operations Inbox, быстрые действия и разделы частично дублируют друг друга.
- Bookings и Rental Details должны стать центром процесса аренды, а не просто списком карточек.
- Documents Center должен быть самостоятельным рабочим объектом с привязками auto/client/rental/status/deadline.

Решение:
- Dashboard = "Что требует внимания сегодня".
- Vehicles = автопарк и карточка авто.
- Clients = CRM, документы, история и долги.
- Rentals = пошаговый rental flow.
- Documents = единый document center.
- Finance = деньги, платежи, депозиты, просрочки.
- GPS = карта, онлайн/offline, скорость, последний сигнал.
- Settings = компания, команда, подписка, язык.

## 2. Mobile First

Проблемы:
- На телефоне часть экранов всё еще ощущается как сжатый desktop.
- Есть риск тяжёлых карточек и горизонтальной перегрузки.
- Действия должны быть ближе к большому пальцу и сгруппированы по сценарию.

Решение:
- Все списки на мобильном только карточками.
- Таблицы на мобильном заменяются на compact cards.
- Основное действие на экране одно.
- Вторичные действия в bottom sheet / action menu.
- Safe area учитывается для drawer, modal, bottom actions.
- Поиск должен работать как глобальный command search.

## 3. Dashboard

Dashboard должен отвечать за 5 секунд:
- Сколько авто занято/свободно.
- Что просрочено.
- Что вернуть сегодня.
- Какие документы/платежи требуют действия.
- Какой следующий самый важный шаг.

Убрать:
- декоративные карточки без решения;
- дублирующие кнопки;
- KPI без действия;
- длинные списки без приоритета.

Добавить:
- Operations Inbox с приоритетами.
- "Next best action".
- KPI только с операционным смыслом.
- Быстрые действия: новая аренда, платеж, документ, расход, ТО.

## 4. UX

Проблемы:
- Лишние клики в rental flow.
- Много модальных действий без контекста.
- Перегруженные формы.
- Дубли действий на dashboard, vehicles, finance, service.
- Не хватает сильных empty/success/error states.
- Пользователь не всегда понимает, что произошло после действия.

Решение:
- Один мастер аренды: авто, клиент, даты, договор, отправка, депозит, выдача, возврат, расчет.
- Detail pages вместо большого количества разрозненных карточек.
- Контекстные действия зависят от статуса.
- После действия всегда показывать toast/success state и следующий шаг.

## 5. SaaS States

Нужно системно довести:
- Empty states: нет авто, нет клиентов, нет документов, нет аренд.
- Loading states: skeleton для dashboard/cards/lists.
- Error states: понятная ошибка + retry.
- Success states: что создано + что делать дальше.
- Notifications: единый центр событий.
- Toast messages: единая система, а не только status banner.

## 6. Design System

Сейчас CSS большой и перегружен. Нужна единая система:
- Colors: нейтральная premium base, один primary, статусы green/blue/orange/red/black.
- Typography: строгая шкала H1/H2/H3/body/caption.
- Buttons: primary, secondary, ghost, danger, icon, full-width mobile.
- Inputs: одинаковые высоты, фокус, ошибки, helper text.
- Cards: один radius, одна тень, один border.
- Badges: status/tone/size.
- Tables: header, row, selected, bulk action, empty.
- Modals: desktop modal, mobile bottom sheet.
- Tabs/dropdowns/forms/charts: один visual language.

## 7. Tables

Проблема: профессиональный слой таблиц неполный.

Нужно:
- сортировка;
- фильтрация;
- поиск;
- сохраненные виды;
- массовые действия;
- экспорт;
- empty state;
- selected state.

Первый внедренный блок начинается именно с этого для Vehicles и Clients.

## 8. CRM

Улучшить:
- карточку клиента: документы, аренды, платежи, долги, прикрепленные авто;
- карточку авто: фото, VIN, пробег, GPS, ROI, документы, сервис, текущая аренда;
- договоры: статусы created/sent/opened/signed;
- документы: auto/client/rental/status/deadline;
- платежи: paid/unpaid/overdue/deposit/refund;
- аренды: единый rental flow history.

## 9. Speed

Проблемы:
- `dashboard-client.tsx` больше 6600 строк.
- `globals.css` больше 8200 строк.
- Большой клиентский компонент увеличивает риск лишних re-render.

Решение:
- Разбить dashboard на feature components.
- Вынести design system компоненты.
- Lazy load тяжелые разделы: GPS map, document preview, rental details.
- Memoize derived data.
- Убрать дубли CSS.

## 10. Code

Технический долг:
- монолитный frontend файл;
- монолитный CSS;
- дубли паттернов кнопок/карточек/форм;
- много inline business UI;
- слабая типовая граница между domain data и UI view model.

Нужно:
- `/components/ui`;
- `/features/vehicles`;
- `/features/customers`;
- `/features/rentals`;
- `/features/documents`;
- hooks для derived data;
- отдельные тесты на пользовательские сценарии.

## 11. Security

Что хорошо:
- tenant isolation есть на backend уровне;
- роли owner/manager уже есть;
- API endpoints используют tenant/company scope.

Что усилить:
- frontend должен скрывать owner-only действия для manager;
- backend должен валидировать запрещенные переходы статусов;
- загрузки файлов должны иметь ограничения типа/размера;
- audit log должен фиксировать критичные действия;
- форма входа должна иметь rate limit на backend.

## 12. Commercial Analysis

Что выглядит дешево:
- обрезанные подписи в меню;
- слишком много кнопок одинакового веса;
- смешение русского/английского в рабочих экранах;
- декоративные KPI без действия;
- большие однотипные карточки без workflow priority.

Что выглядит непрофессионально:
- нет единого table/list framework;
- нет системного toast/skeleton/empty/error approach;
- не все действия ощущаются завершенными процессами;
- монолитность кода замедляет качество.

Что может отпугнуть клиента:
- непонятно, где ежедневная работа;
- на телефоне тяжело воспринимать плотные блоки;
- формы требуют слишком много решений сразу;
- экспорт/массовые действия отсутствуют или спрятаны;
- статусы договоров/документов/аренд не всегда собраны в один поток.

## 100 Improvements Backlog

### Critical

1. Сделать Dashboard операционным: today tasks, overdue, returns, payments, documents.
2. Убрать дубли быстрых действий на одном экране.
3. Сделать единый rental flow master.
4. Сделать rental detail page с timeline.
5. Сделать document center с auto/client/rental/deadline/status.
6. Добавить full empty states для всех разделов.
7. Добавить full error states с retry.
8. Добавить success states после CRUD.
9. Добавить unified toast system.
10. Добавить skeleton loaders на dashboard/lists/details.
11. Исправить мобильную навигацию как app drawer + bottom-safe actions.
12. Сделать mobile cards вместо desktop tables.
13. Ввести профессиональные list controls: sort/filter/saved views/export/bulk.
14. Скрывать owner-only действия для manager.
15. Backend validation для rental status transitions.
16. Backend validation для payments/deposits/refunds.
17. Проверить API 401/403/404/500 flows.
18. Убрать смешение языков в visible UI.
19. Разбить `dashboard-client.tsx` на feature components.
20. Разбить `globals.css` на design system и feature styles.
21. Сделать onboarding после регистрации обязательным и коротким.
22. Проверить все кнопки E2E: no inert buttons.
23. Сделать client intake link полноценным внешним flow.
24. Проверить file uploads: type, size, success, error.
25. Настроить deploy verification checklist.

### High

26. Улучшить vehicle profile: фото, финансы, документы, сервис, rental state.
27. Улучшить client profile: документы, аренды, долги, linked cars.
28. Сделать search как command center.
29. Добавить сохраненные фильтры в Vehicles.
30. Добавить сохраненные фильтры в Clients.
31. Добавить export CSV/PDF для рабочих списков.
32. Добавить bulk select для Vehicles.
33. Добавить bulk select для Clients.
34. Добавить contextual actions по статусу аренды.
35. Добавить договор statuses: draft/sent/opened/signed.
36. Добавить send actions WhatsApp/Telegram/email в one panel.
37. Добавить audit log в UI.
38. Добавить better role management owner/manager.
39. Добавить document expiry reminders.
40. Добавить unpaid/overdue finance queue.
41. Сделать Finance как money operations, а не набор метрик.
42. Сделать GPS premium module с provider manual setup.
43. Добавить online/offline/speed/last signal в GPS cards.
44. Добавить Apple/Google map inside SaaS, не внешним переходом.
45. Улучшить mobile safe-area для modals.
46. Сделать modal bottom sheet на телефоне.
47. Увеличить touch targets до 44-52 px.
48. Упростить формы до progressive disclosure.
49. Добавить draft auto-save для важных форм.
50. Сделать all table headers sticky на desktop.
51. Добавить visible row density controls.
52. Добавить no-results state для поиска.
53. Добавить success next step после создания авто.
54. Добавить success next step после создания клиента.
55. Добавить success next step после создания аренды.
56. Добавить download/open preview для документов.
57. Добавить payments timeline в rental details.
58. Добавить final settlement screen.
59. Добавить deposit refund workflow.
60. Добавить customer-facing upload checklist.
61. Добавить backend constraints for tenant data.
62. Добавить rate limiting auth endpoints.
63. Добавить frontend route guards.
64. Добавить test data cleanup.
65. Добавить Cypress/Playwright coverage for mobile.

### Medium

66. Добавить dashboard presets по роли.
67. Добавить notification preferences.
68. Добавить customizable contract template.
69. Добавить company branding preview.
70. Добавить vehicle photo fallback library.
71. Добавить guided empty states with create action.
72. Добавить import vehicles CSV.
73. Добавить import customers CSV.
74. Добавить export documents index.
75. Добавить document status verification.
76. Добавить service history timeline.
77. Добавить expense categories.
78. Добавить finance charts with meaningful drilldowns.
79. Добавить printable rental summary.
80. Добавить compact desktop mode.
81. Добавить keyboard shortcuts for search/create.
82. Добавить accessibility focus states.
83. Добавить aria labels для icon buttons.
84. Добавить локализованные статусы из data layer.
85. Добавить API contract tests.
86. Добавить frontend smoke tests per section.
87. Добавить bundle analyzer.
88. Добавить lazy loading для maps.
89. Добавить lazy loading для document preview.
90. Добавить optimistic UI для быстрых CRUD.

### Low

91. Добавить microcopy polish для подсказок.
92. Добавить premium illustrations only in empty states.
93. Добавить theme tokens for future white-label.
94. Добавить saved dashboard layout.
95. Добавить advanced GPS trip history later.
96. Добавить CSV column picker later.
97. Добавить Stripe subscription UI later.
98. Добавить custom SLA/status page later.
99. Добавить multi-branch company structure later.
100. Добавить marketplace integrations later.

## Implementation Start

Первый Critical/High блок:
- professional list controls для Vehicles и Clients;
- сохраненные виды;
- сортировка;
- массовый выбор видимых записей;
- экспорт CSV;
- empty states для пустого результата;
- минимальное вмешательство в business logic.

