/*
  # Ajout des colonnes manquantes à shopping_lists
  
  1. Modifications de la table shopping_lists
    - Ajout de `status` (text: 'active', 'completed', 'archived')
    - Ajout de `is_archived` (boolean, default false)
    - Ajout de `completed_count` (integer, default 0)
    - Ajout de `estimated_budget_cents` (integer, default 0)
    - Ajout de `session_id` (text, nullable)
    - Ajout de `title` (text, default 'Liste de Courses')
    
  2. Modifications de la table shopping_list_items
    - Renommage de `estimated_price` vers `estimated_price_cents` (integer)
  
  3. Index additionnels
    - Index sur status pour requêtes rapides
    - Index sur is_archived pour filtrage
  
  4. Note
    - Ces colonnes sont nécessaires pour la compatibilité avec le ShoppingListDataCollector
*/

-- Ajouter les colonnes manquantes à shopping_lists
DO $$
BEGIN
  -- Ajouter status si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_lists' AND column_name = 'status'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived'));
  END IF;

  -- Ajouter is_archived si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_lists' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
  END IF;

  -- Ajouter completed_count si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_lists' AND column_name = 'completed_count'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN completed_count integer NOT NULL DEFAULT 0;
  END IF;

  -- Ajouter estimated_budget_cents si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_lists' AND column_name = 'estimated_budget_cents'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN estimated_budget_cents integer NOT NULL DEFAULT 0;
  END IF;

  -- Ajouter session_id si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_lists' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN session_id text;
  END IF;

  -- Ajouter title si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_lists' AND column_name = 'title'
  ) THEN
    ALTER TABLE shopping_lists ADD COLUMN title text NOT NULL DEFAULT 'Liste de Courses';
  END IF;
END $$;

-- Modifier shopping_list_items pour renommer estimated_price vers estimated_price_cents
DO $$
BEGIN
  -- Vérifier si estimated_price existe et estimated_price_cents n'existe pas
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_list_items' AND column_name = 'estimated_price'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_list_items' AND column_name = 'estimated_price_cents'
  ) THEN
    -- Ajouter la nouvelle colonne
    ALTER TABLE shopping_list_items ADD COLUMN estimated_price_cents integer NOT NULL DEFAULT 0;
    
    -- Migrer les données (convertir de decimal à cents)
    UPDATE shopping_list_items SET estimated_price_cents = ROUND(estimated_price * 100)::integer;
    
    -- Supprimer l'ancienne colonne
    ALTER TABLE shopping_list_items DROP COLUMN estimated_price;
  END IF;
  
  -- Si estimated_price_cents n'existe pas encore (nouvelle installation)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_list_items' AND column_name = 'estimated_price_cents'
  ) THEN
    ALTER TABLE shopping_list_items ADD COLUMN estimated_price_cents integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS shopping_lists_status_idx ON shopping_lists(status);
CREATE INDEX IF NOT EXISTS shopping_lists_is_archived_idx ON shopping_lists(is_archived);
CREATE INDEX IF NOT EXISTS shopping_lists_user_status_idx ON shopping_lists(user_id, status) WHERE is_archived = false;
