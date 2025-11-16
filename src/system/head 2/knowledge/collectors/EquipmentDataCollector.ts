/**
 * EquipmentDataCollector - Collects Equipment Data
 * Aggregates training locations and available equipment
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type { EquipmentKnowledge, TrainingLocation } from '../../types';

export class EquipmentDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<EquipmentKnowledge> {
    try {
      logger.debug('EQUIPMENT_COLLECTOR', 'Collecting equipment data', { userId });

      const [locations, defaultLocationId] = await Promise.all([
        this.getLocations(userId),
        this.getDefaultLocationId(userId)
      ]);

      const availableEquipment = this.aggregateEquipment(locations);
      const lastScanDate = this.getLastScanDate(locations);

      return {
        locations,
        availableEquipment,
        defaultLocationId,
        lastScanDate
      };
    } catch (error) {
      logger.error('EQUIPMENT_COLLECTOR', 'Failed to collect equipment data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async getLocations(userId: string): Promise<TrainingLocation[]> {
    try {
      const { data, error } = await this.supabase
        .from('training_locations')
        .select('id, name, type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('EQUIPMENT_COLLECTOR', 'Failed to get locations', { error });
        return [];
      }

      // For each location, get equipment
      const locationsWithEquipment = await Promise.all(
        (data || []).map(async (loc) => {
          const { data: equipmentData } = await this.supabase
            .from('training_location_equipment')
            .select('equipment_name')
            .eq('location_id', loc.id);

          return {
            id: loc.id,
            name: loc.name,
            type: loc.type,
            equipment: (equipmentData || []).map(eq => eq.equipment_name)
          };
        })
      );

      return locationsWithEquipment;
    } catch (error) {
      logger.error('EQUIPMENT_COLLECTOR', 'Exception getting locations', { error });
      return [];
    }
  }

  private async getDefaultLocationId(userId: string): Promise<string | null> {
    try {
      // Check if column exists by trying to query it
      const { data, error } = await this.supabase
        .from('training_locations')
        .select('id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();

      if (error || !data) {
        // Fallback: return the first location
        const { data: firstLocation } = await this.supabase
          .from('training_locations')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return firstLocation?.id || null;
      }

      return data.id;
    } catch (error) {
      logger.warn('EQUIPMENT_COLLECTOR', 'Could not get default location', { error });
      return null;
    }
  }

  private aggregateEquipment(locations: TrainingLocation[]): string[] {
    const equipmentSet = new Set<string>();

    locations.forEach(loc => {
      loc.equipment.forEach(eq => equipmentSet.add(eq));
    });

    return Array.from(equipmentSet);
  }

  private getLastScanDate(locations: TrainingLocation[]): string | null {
    if (locations.length === 0) return null;

    // Note: This would need last_scan_date from the query
    return new Date().toISOString();
  }
}
