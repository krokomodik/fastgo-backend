--
-- PostgreSQL database dump
--

\restrict A0gPl1xPfblr4f3naSMcgCLthgeZsWmdfTPBPgicPyDCYexue3wl6z5o5GWg3eP

-- Dumped from database version 16.2
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users (id, name, phone, email, password, address, role) VALUES (1, '???? ??????', '+79001234567', 'ivan@test.com', '$2a$10$TXC8s6NJfAI3qjvJySyvzuYlhRNTu4Taz/Ii9SmlGP2ECd1/Q.vBe', '??. ??????, 10, ?? 5', 'client');
INSERT INTO public.users (id, name, phone, email, password, address, role) VALUES (2, 'Admin', '+79000000000', 'admin@test.com', '$2a$10$OgJkLRS8urRi/WB8zrQ28.D7TAFaqqOXGmo6ZSQaq2nprylVEuXqy', '', 'admin');
INSERT INTO public.users (id, name, phone, email, password, address, role) VALUES (15, 'Курьер Иван', '+79001112233', 'courier@test.com', '$2a$10$tRr9hF1VTBxPW/FvlT3GY.3ibVuVWCWv59BmtfJ1hBSHy9U.Riesm', '', 'courier');
INSERT INTO public.users (id, name, phone, email, password, address, role) VALUES (16, 'Новый клиент', '+70000000000', 'tkto1537@gmail.com', '$2a$10$HiAAGlyc9TwzMyXYF4E.L.1eNVqIYAuyz49nnCOQKNSNuPdf2YZ7.', 'Не указан', 'client');


--
-- Data for Name: couriers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.couriers (id, user_id, full_name, passport, photo, transport, is_online, lat, lng) VALUES (2, 15, NULL, NULL, NULL, NULL, true, 59.9343, 30.3351);


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (1, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца Маргарита', '2026-05-30 15:00:02.50967');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (2, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца Маргарита', '2026-05-30 15:00:03.043569');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (3, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:01:58.295411');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (5, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца Маргарита', '2026-05-30 15:04:26.599576');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (7, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:20.138772');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (8, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:22.101924');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (9, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:22.518137');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (10, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:23.149877');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (11, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:29.46488');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (12, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:30.383853');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (13, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:30.967027');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (14, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:31.462353');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (15, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:32.110532');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (16, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:32.286816');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (17, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:27:32.662888');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (18, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:29:28.103479');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (19, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца Маргарита', '2026-05-30 15:37:15.918118');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (20, 1, NULL, 'new', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца Маргарита', '2026-05-30 15:40:26.161242');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (6, 1, 15, 'delivered', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца Маргарита', '2026-05-30 15:09:09.550487');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (4, 1, 15, 'delivered', 500, 'Ресторан', 'ул. Ленина, 10', 'Пицца', '2026-05-30 15:01:58.670652');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (22, 1, 15, 'accepted', 500, 'Ресторан', '', '', '2026-05-30 20:45:24.175003');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (21, 1, 15, 'accepted', 123, 'пятерочка', 'мой адрес', 'салатик бурмалдатик ', '2026-05-30 18:47:15.480304');
INSERT INTO public.orders (id, client_id, courier_id, status, price, pickup_address, delivery_address, description, created_at) VALUES (23, 1, NULL, 'new', 500, 'лесная 3', 'Ленина 5', 'салат', '2026-05-30 21:16:47.711274');


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Name: couriers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.couriers_id_seq', 2, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 23, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 16, true);


--
-- PostgreSQL database dump complete
--

\unrestrict A0gPl1xPfblr4f3naSMcgCLthgeZsWmdfTPBPgicPyDCYexue3wl6z5o5GWg3eP

