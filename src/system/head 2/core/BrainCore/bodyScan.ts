import logger from '../../../../lib/utils/logger';
import type { UserKnowledgeBase } from '../../knowledge/UserKnowledgeBase';

export async function getBodyScanWithInsights(
  knowledgeBase: UserKnowledgeBase | null,
  currentUserId: string | null,
  scanId?: string
): Promise<{
  scan: any | null;
  insights: any[];
  summary: any | null;
}> {
  if (!knowledgeBase || !currentUserId) {
    throw new Error('Brain not initialized');
  }

  try {
    const knowledge = await knowledgeBase.getUserKnowledge();
    const bodyScan = knowledge.bodyScan;

    let targetScan = null;
    if (scanId) {
      targetScan = bodyScan.recentScans.find(s => s.id === scanId);
    } else {
      targetScan = bodyScan.recentScans[0] || null;
    }

    const insights = bodyScan.morphologyInsights.latestInsights;
    const summary = bodyScan.morphologyInsights.summary;

    logger.info('BRAIN_CORE', 'Retrieved body scan with insights', {
      scanId: targetScan?.id,
      insightsCount: insights.length,
      hasSummary: !!summary
    });

    return {
      scan: targetScan,
      insights,
      summary
    };
  } catch (error) {
    logger.error('BRAIN_CORE', 'Failed to get body scan with insights', {
      scanId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export async function getMorphologyInsightsContext(
  knowledgeBase: UserKnowledgeBase | null
): Promise<string> {
  if (!knowledgeBase) {
    return '';
  }

  try {
    const knowledge = await knowledgeBase.getUserKnowledge();
    const insights = knowledge.bodyScan.morphologyInsights;

    if (!insights.hasData || insights.latestInsights.length === 0) {
      return '';
    }

    const highPriorityInsights = insights.latestInsights
      .filter(i => i.priority === 'high')
      .slice(0, 3);

    if (highPriorityInsights.length === 0) {
      return '';
    }

    const contextParts = [
      '\n### Insights Morphologiques IA (Dernière Analyse)',
      ...highPriorityInsights.map(insight =>
        `- **${insight.title}**: ${insight.description}`
      )
    ];

    if (insights.summary) {
      contextParts.push(
        `\nScores: Morphologie ${(insights.summary.morphology_score * 100).toFixed(0)}%, ` +
        `Alignement Objectifs ${(insights.summary.goal_alignment * 100).toFixed(0)}%, ` +
        `Indicateurs Santé ${(insights.summary.health_indicators * 100).toFixed(0)}%`
      );
    }

    return contextParts.join('\n');
  } catch (error) {
    logger.error('BRAIN_CORE', 'Failed to get morphology insights context', { error });
    return '';
  }
}
