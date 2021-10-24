import * as models from '../models';
import { ParserRegex } from './parserRegex';
import * as utils from '../utils';
import { log, userInteractionProvider } from '../io';

export async function parseVariable(getLineReader: models.getHttpLineGenerator, { httpRegion }: models.ParserContext): Promise<models.HttpRegionParserResult> {
  if (!httpRegion.variables) {
    httpRegion.hooks.execute.addInterceptor(new VariableInterceptor());
    httpRegion.variables = {};
  }


  const lineReader = getLineReader();
  const next = lineReader.next();
  if (!next.done) {
    const textLine = next.value.textLine;

    const match = ParserRegex.variable.exec(textLine);

    if (match && match.groups && match.groups.key && match.groups.value) {

      httpRegion.variables[match.groups.key] = match.groups.value.trim();

      return {
        nextParserLine: next.value.line,
        symbols: [{
          name: match.groups.key,
          description: match.groups.value,
          kind: models.HttpSymbolKind.variable,
          startLine: next.value.line,
          startOffset: 0,
          endLine: next.value.line,
          endOffset: next.value.textLine.length,
          children: [{
            name: match.groups.key,
            description: 'key',
            kind: models.HttpSymbolKind.key,
            startLine: next.value.line,
            startOffset: next.value.textLine.indexOf(match.groups.key),
            endLine: next.value.line,
            endOffset: next.value.textLine.indexOf(match.groups.key) + match.groups.key.length,
          }, {
            name: match.groups.value,
            description: 'value',
            kind: models.HttpSymbolKind.value,
            startLine: next.value.line,
            startOffset: next.value.textLine.indexOf(match.groups.value),
            endLine: next.value.line,
            endOffset: next.value.textLine.indexOf(match.groups.value) + match.groups.value.length,
          }]
        }],
      };
    }
  }
  return false;
}


class VariableInterceptor implements models.HookInterceptor<models.ProcessorContext, boolean> {
  id = models.ActionType.variable;

  private variables: models.Variables | undefined;


  async beforeLoop(context: models.HookTriggerContext<models.ProcessorContext, true>) {
    this.initRegionScopedVariables(context.arg);
    await this.setCurrentVariables(context.arg);
    await this.replaceAllVariables(context.arg);
    return true;
  }

  private async replaceAllVariables(context: models.ProcessorContext) : Promise<boolean> {
    for (const [key, value] of Object.entries(context.variables)) {
      const result: typeof models.HookCancel | unknown = await utils.replaceVariables(value, models.VariableType.variable, context);
      if (result !== models.HookCancel) {
        context.variables[key] = result;
      }
    }
    return true;
  }


  private initRegionScopedVariables(context: models.ProcessorContext) {
    const env = utils.toEnvironmentKey(context.httpFile.activeEnvironment);
    const variables = Object.assign(
      {},
      context.variables,
      ...context.httpFile.httpRegions
        .filter(obj => utils.isGlobalHttpRegion(obj))
        .map(obj => obj.variablesPerEnv[env])
    );
    this.variables = context.variables;
    context.variables = variables;
  }

  private async setCurrentVariables(context: models.ProcessorContext) {
    if (context.httpRegion.variables) {
      const replacedVariables: models.Variables = {};
      for (const [key, value] of Object.entries(context.httpRegion.variables)) {
        if (utils.isValidVariableName(key)) {
          replacedVariables[key] = await utils.replaceVariables(value, models.VariableType.variable, context);
        } else {
          const message = `Javascript Keyword ${key} not allowed as variable`;
          userInteractionProvider.showWarnMessage?.(message);
          log.warn(message);
        }
      }
      utils.setVariableInContext(replacedVariables, context);
    }
  }

  async afterLoop(context: models.HookTriggerContext<models.ProcessorContext, true>) {
    this.autoShareNewVariables(context);
    if (this.variables) {
      context.arg.variables = this.variables;
    }
    return true;
  }

  private autoShareNewVariables(context: models.HookTriggerContext<models.ProcessorContext, true>) {
    if (this.variables) {
      for (const [key, value] of Object.entries(context.arg.variables)) {
        if (!this.variables[key]) {
          this.variables[key] = value;
        }
      }
    }
  }
}
