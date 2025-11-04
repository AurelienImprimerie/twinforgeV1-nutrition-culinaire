/*
  # Fix meal_plans Status Constraint

  ## Changes
  - Drop the existing status check constraint
  - Add new status check constraint with 'completed' value included
  - The constraint now allows: 'draft', 'active', 'completed', 'archived'

  ## Reason
  The application is trying to save meal plans with status='completed',
  but the constraint only allowed 'draft', 'active', 'archived'.
  This was causing insert failures with error code 23514.

  ## Security
  - No RLS changes needed
  - Maintains data integrity with updated valid status values
*/

-- Drop existing status check constraint
ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_status_check;

-- Add new status check constraint with 'completed' included
ALTER TABLE meal_plans ADD CONSTRAINT meal_plans_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'archived'::text]));