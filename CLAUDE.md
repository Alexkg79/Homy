# App tâches familiales/coloc — Spec projet (nom provisoire)

## Concept
Une famille ou coloc crée un groupe. Chaque tâche a une **fenêtre de réalisation**
(début / temps dispo / deadline) plutôt qu'une heure fixe. Le membre assigné reçoit
des notifs (assignation, rappel avant deadline, retard) et peut Terminer / Reporter /
Refuser / Proposer un autre horaire.

Positionnement : "L'app qui organise les tâches de toute la maison, sans avoir besoin
de se demander qui fait quoi." Différenciant visé à terme : un moteur de planning
auto (membres + dispos + tâches + fréquence → planning de la semaine généré).

## Stack technique
- Expo SDK **54** (Expo Go = 54.0.8, donc on pin dessus)
- expo-router, TypeScript
- Supabase (Auth, Postgres, Realtime, Edge Functions pour le scheduling des notifs)
- expo-notifications (push)
- State léger : Zustand (ou Context si suffisant)

## Modèle de données (V1)
- `groups` (id, name, invite_code)
- `group_members` (id, group_id, user_id, display_name, avatar)
- `tasks` (id, group_id, title, icon, type: `ponctuelle` | `recurrente` | `rotation`, recurrence_rule, created_by)
- `task_instances` (id, task_id, assigned_to, date, window_start, window_duration, deadline, status: `a_faire` | `terminee` | `en_retard` | `refusee` | `reportee`)
- `task_exchanges` (id, task_instance_id, from_user, to_user, offered_task_instance_id, status) — **V2**
- `notifications_log` (optionnel, debug/traçabilité)

## Scope V1 (MVP)
Inclus :
- Création de groupe + invitation par code
- Tâches ponctuelles + récurrentes (rotation simple si le temps le permet, sinon V1.5)
- Fenêtre de réalisation (début / durée dispo / deadline) + notifs (assignation, rappel, retard)
- Actions : Terminer / Reporter / Refuser
- Écran principal : liste du jour type timeline (voir maquette texte ci-dessous)
- Stats simples (% de tâches à l'heure)

Reporté en V2 :
- Rotation automatique multi-tâches
- Échange de tâches entre membres
- Moteur de planning automatique
- Score maison / gamification légère (pas de classement pur pour éviter les tensions —
  privilégier un % collectif + stats perso type "🔥 X jours sans retard")

## Écran principal (référence UX)
Liste chronologique du jour, un item = icône statut (à faire / faite / en cours avec
temps restant / en retard) + tâche + assigné + statut. Clic sur une tâche → détail.

## Phases de build (approche itérative, comme pour Ascend)
1. Setup env + dépendances + structure projet
2. Auth + création/rejoindre un groupe (Supabase)
3. CRUD tâches + logique de fenêtre de réalisation
4. Notifications (push + scheduling, Edge Function ou cron Supabase)
5. Écran principal + actions (terminer/reporter/refuser)
6. Stats simples
7. V2 : rotation auto, échanges, moteur de planning

## Contraintes de dev
- Solo dev, pas de deadline fixe
- Construire phase par phase, valider chaque étape avant la suivante
- Pas de sur-ingénierie prématurée — MVP d'abord, extensibilité gardée en tête
