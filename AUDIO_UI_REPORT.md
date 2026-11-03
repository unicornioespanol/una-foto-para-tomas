# Финальная интеграция аудио и интерфейса · 29 октября 2026

Подключены **29 исходных MP3**: 14 сюжетных и 15 коротких. Исходные имена, содержимое файлов и утверждённые story.json/activities.json сохранены. Карта: data/audio-manifest.json; контрольные суммы записей: data/audio-inventory.json. Ничего не генерировалось, TTS в приложении не вызывается.

## ID → реальный MP3 → статус

| Узел / кнопка | Реальный путь | Статус |
| --- | --- | --- |
| s01 | assets/audio/s01 · Hoy es el Día de Muertos_1.mp3 | Подключён; 8.52 с; декодирование/начало/конец OK |
| s02 | assets/audio/s02 · El abuelo Tomás.mp3 | Подключён; 12.28 с; декодирование/начало/конец OK |
| s03 | assets/audio/s03 · La foto vuela_2.mp3 | Подключён; 7.63 с; декодирование/начало/конец OK |
| s04 | assets/audio/s04 · ¿Qué hacemos_2.mp3 | Подключён; 8.36 с; декодирование/начало/конец OK |
| a05 | assets/audio/a05 · El gato negro_2.mp3 | Подключён; 9.48 с; декодирование/начало/конец OK |
| a06 | assets/audio/a06 · La pelota_1.mp3 | Подключён; 9.40 с; декодирование/начало/конец OK |
| a07 | assets/audio/a07 · Otra foto_2.mp3 | Подключён; 10.76 с; декодирование/начало/конец OK |
| b05 | assets/audio/b05 · El dibujo empieza_2.mp3 | Подключён; 11.47 с; декодирование/начало/конец OK |
| b06 | assets/audio/b06 · La guitarra_2.mp3 | Подключён; 11.73 с; декодирование/начало/конец OK |
| b07 | assets/audio/b07 · Ahora sí_1.mp3 | Подключён; 11.39 с; декодирование/начало/конец OK |
| s08 | assets/audio/s08 · La familia está aquí_1.mp3 | Подключён; 8.28 с; декодирование/начало/конец OK |
| end-song | assets/audio/end-song · Una canción_1.mp3 | Подключён; 14.03 с; декодирование/начало/конец OK |
| end-story:photo | assets/audio/end-story-photo · Una historia · ruta de la foto_2.mp3 | Подключён; 13.48 с; декодирование/начало/конец OK |
| end-story:drawing | assets/audio/end-story-drawing · Una historia · ruta del dibujo_2.mp3 | Подключён; 13.64 с; декодирование/начало/конец OK |
| pre-who-lucia | assets/audio/pre-who-lucia_1.mp3 | Подключён; 1.23 с; декодирование/начало/конец OK |
| pre-who-abuela | assets/audio/pre-who-abuela_1.mp3 | Подключён; 1.72 с; декодирование/начало/конец OK |
| pre-who-tomas | assets/audio/pre-who-tomas_1.mp3 | Подключён; 2.27 с; декодирование/начало/конец OK |
| pre-touch-gafas | assets/audio/pre-touch-gafas_1.mp3 | Подключён; 1.23 с; декодирование/начало/конец OK |
| pre-touch-bigote | assets/audio/pre-touch-bigote_2.mp3 | Подключён; 1.65 с; декодирование/начало/конец OK |
| pre-ofrenda-flores | assets/audio/pre-ofrenda-flores_1.mp3 | Подключён; 0.91 с; декодирование/начало/конец OK |
| pre-ofrenda-agua | assets/audio/pre-ofrenda-agua_1.mp3 | Подключён; 0.91 с; декодирование/начало/конец OK |
| pre-ofrenda-pan | assets/audio/pre-ofrenda-pan_1.mp3 | Подключён; 0.91 с; декодирование/начало/конец OK |
| pre-ofrenda-foto | assets/audio/pre-ofrenda-foto_1.mp3 | Подключён; 0.76 с; декодирование/начало/конец OK |
| choice-buscar-foto | assets/audio/choice-buscar-foto_2.mp3 | Подключён; 1.31 с; декодирование/начало/конец OK |
| choice-dibujar | assets/audio/choice-dibujar_1.mp3 | Подключён; 1.49 с; декодирование/начало/конец OK |
| choice-cancion | assets/audio/choice-cancion_1.mp3 | Подключён; 1.07 с; декодирование/начало/конец OK |
| choice-historia | assets/audio/choice-historia_1.mp3 | Подключён; 1.07 с; декодирование/начало/конец OK |
| post-e2-gato | assets/audio/post-e2-gato_2.mp3 | Подключён; 1.88 с; декодирование/начало/конец OK |
| post-e2-cantar | assets/audio/post-e2-cantar_1.mp3 | Подключён; 1.31 с; декодирование/начало/конец OK |

Лишние записи: нет. Неоднозначные соответствия: нет. Отсутствующие обязательные записи из списка 14 + 15: нет. Суффиксы _1/_2 и описательные сюжетные имена сохранены, исходники не переименованы.

Техническая проверка: все 29 MP3 целиком декодированы Web Audio, воспроизведены в HTMLAudioElement в начале и у конца, достигнуто событие ended. Четыре маршрута в интерфейсе выбирают правильные 14 имён; end-story разделён на photo/drawing. Это проверка файлов, маршрутизации и воспроизведения. Дословное речевое содержание человеком/ASR в этой среде не подтверждалось; смысловое соответствие установлено по переданным именам/ID. Таймкодов нет: синхронная подсветка реплик и слов не имитируется. На s03/b06 воспроизводится исключительно готовый файл, дополнительные ветер/напев не накладываются.

## Тексты без отдельных записей

В папке нет аудио для вопроса pre-prediction, общей инструкции matching, feedback, пересказов E1 и динамических фраз E3. Они остаются читаемыми; не показываются неработающие кнопки озвучки и не подставляется системный голос. Слова matching и опорные реплики E2 имеют собственные рабочие кнопки. Для «Кто есть кто» проигрывается только текущая реплика, не три подряд.

## Плеер и интерфейс

- Один AudioController, настоящий pause/resume с текущей позиции, повтор с начала, остановка до навигации и при скрытии вкладки. Поздние события старых объектов и отклонённые play-промисы не меняют новый экран. Без autoplay и без синтеза.
- Карточки семьи выбираются из двух перестановок без совпадений с порядком реплик. familyOrder сохранён в прогрессе и восстанавливается при возврате/перезагрузке. При ошибке порядок не меняется.
- Убраны настройки системного голоса/скорости. «Opciones» содержит только перезапуск и существующий доступ к согласию в research-режиме. Mostrar/Ocultar texto сохранены.
- Исправлены явные строки mobile matching-grid, гибкое сжатие и размеры кнопок: Comprobar не пересекается с карточками, feedback и нижней навигацией в состояниях ошибки/успеха на шести размерах из ТЗ. Переполнение не скрывается.
- Схема сервера/БД не менялась. Клиент передаёт существующие audio_started/paused/stopped/ended/repeated с source=file; pause/resume сохраняет один audio_play_id и не удваивает starts.

## Точечная ретушь кота

Просмотрены контактные листы 36 файлов: сцены с desktop/mobile и общими финалами, используемые референсы, cat-варианты альбома и memory-cat. Исправлены только семь сплошных радужек без тёмного центра; существующие нормальные зрачки, закрытые глаза и взгляд со спины оставлены.

| PNG | Изменённые пиксели | Область |
| --- | --- | --- |
| assets/scenes/a05-desktop.png | 245 из 1573044 | Только внутри радужек |
| assets/scenes/a05-mobile.png | 113 из 1573230 | Только внутри радужек |
| assets/scenes/a06-desktop.png | 43 из 1573044 | Только внутри радужек |
| assets/scenes/b05-desktop.png | 68 из 1573044 | Только внутри радужек |
| assets/scenes/b05-mobile.png | 98 из 1573230 | Только внутри радужек |

Все пиксели вне семи проверенных масок сохранены побайтно в декодированном PNG. Размеры и композиция не менялись. У соответствующих WebP обновлены веб-копии. Резервные исходники: backups/before-final-audio/assets/scenes. До/после: test-results/cat-eyes/retouched-*.png. Точные координаты и хеши: data/cat-eye-retouch.json. Исходный book_update не изменён.

## Сборки и запуск

Dev: npm.cmd run dev. Build: npm.cmd run build. В dist/assets/audio лежат отдельные MP3 с исходными именами; в HTML нет data:audio/base64 записей.

Для открытия без сервера использовать **всю папку offline/**: внутри Una foto para Tomas.html и assets/audio/*.mp3. Корневой HTML тоже работает с соседней assets/audio. Передача одного HTML сохраняет чтение и картинки, но не переносит звук. В file:// аналитика выключена.

## Изменённые файлы

data/audio-manifest.json, data/audio-inventory.json, data/cat-eye-retouch.json; src/audio-controller.js, src/audio-map.js, src/family-order.js, src/main.js, src/pre-activities.js, src/activities.js, src/storage.js, src/telemetry.js, src/update.css; vite.config.js; tools/audio-assets.mjs, tools/standalone.mjs, tools/prepare-assets.mjs, tools/file-audio.test.mjs, tools/audio-browser.mjs, tools/final-audio-ui-browser.mjs, tools/browser-check.mjs, tools/research-browser.mjs, tools/telemetry-browser.mjs, tools/inspect-cat-eyes.mjs, tools/retouch-cat-eyes.mjs, tools/write-audio-report.mjs; пять PNG/WebP выше; package.json, README.md, QA_REPORT.md. Backend, PostgreSQL/PGlite, SQL, согласия и admin API не переписывались. Публикации и платных запросов не было.
