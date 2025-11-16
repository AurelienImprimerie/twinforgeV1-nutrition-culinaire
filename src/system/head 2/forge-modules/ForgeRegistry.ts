/**
 * ForgeRegistry - Register and Manage Forge Modules
 */

import logger from '../../../lib/utils/logger';
import type { IForgeModule, ForgeType } from '../types';

export class ForgeRegistry {
  private modules: Map<ForgeType, IForgeModule>;

  constructor() {
    this.modules = new Map();
  }

  register(module: IForgeModule): void {
    if (this.modules.has(module.forgeType)) {
      logger.warn('FORGE_REGISTRY', 'Forge module already registered, overwriting', {
        forgeType: module.forgeType
      });
    }

    this.modules.set(module.forgeType, module);

    logger.info('FORGE_REGISTRY', 'Forge module registered', {
      forgeType: module.forgeType
    });
  }

  get(forgeType: ForgeType): IForgeModule | null {
    return this.modules.get(forgeType) || null;
  }

  getAll(): IForgeModule[] {
    return Array.from(this.modules.values());
  }

  has(forgeType: ForgeType): boolean {
    return this.modules.has(forgeType);
  }

  unregister(forgeType: ForgeType): void {
    this.modules.delete(forgeType);
    logger.info('FORGE_REGISTRY', 'Forge module unregistered', { forgeType });
  }
}
