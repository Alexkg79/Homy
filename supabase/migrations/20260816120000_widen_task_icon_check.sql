-- Élargit tasks_icon_check (posée dans 20260809130000_create_tasks_and_instances.sql,
-- char_length between 1 and 8) : cette borne visait un emoji unique, mais le
-- picker interne (components/IconPickerField.tsx) stocke désormais un nom
-- Ionicons (ex: "checkmark-circle-outline", 24 caractères) dans tasks.icon,
-- ce qui viole systématiquement la contrainte à la création. On élargit la
-- borne haute plutôt que de la retirer complètement : components/TaskIcon.tsx
-- affiche indifféremment emoji (ancien format) ou nom Ionicons (nouveau
-- format) sans distinction de longueur particulière, mais garder une borne
-- raisonnable évite quand même d'accepter une chaîne vide ou aberrante.

alter table tasks drop constraint if exists tasks_icon_check;
alter table tasks add constraint tasks_icon_check check (char_length(trim(icon)) between 1 and 40);
