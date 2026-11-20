import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller, Inject, Injectable, Module, Type } from '@nestjs/common';
import { MODULE_METADATA, SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module';

// SW-29 / ADR-002: o dev runner (tsx) e o vitest usam esbuild, que não emite decorator metadata.
// Sem metadata, o Nest não descobre o tipo do parâmetro e injeta `undefined` sem avisar: a API sobe
// e só quebra na primeira requisição. Por isso toda injeção por construtor precisa de @Inject(Token).
// Este teste percorre a árvore real de módulos e falha se alguma classe do grafo não declarar.

type Provider = Type | { provide: unknown; useClass?: Type; useFactory?: (...args: never[]) => unknown; inject?: unknown[] };

// Parâmetros com valor padrão não entram em `Function.length` e não são injetados.
function missingInjectIndexes(cls: Type): number[] {
  const declared: { index: number }[] = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, cls) ?? [];
  const covered = new Set(declared.map((d) => d.index));
  return Array.from({ length: cls.length }, (_, i) => i).filter((i) => !covered.has(i));
}

const nameOf = (token: unknown) =>
  typeof token === 'function' ? token.name : typeof token === 'symbol' ? token.toString() : String(token);

// Só segue imports que são classes de módulo nossas; módulos dinâmicos (ex.: MulterModule) são de
// terceiros, compilados com tsc e com metadata própria.
function findImplicitInjections(root: Type): string[] {
  const problems: string[] = [];
  const visited = new Set<Type>();
  const visit = (mod: Type) => {
    if (visited.has(mod)) return;
    visited.add(mod);
    const controllers: Type[] = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, mod) ?? [];
    const providers: Provider[] = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, mod) ?? [];
    const imports: unknown[] = Reflect.getMetadata(MODULE_METADATA.IMPORTS, mod) ?? [];

    const checkClass = (cls: Type) => {
      const missing = missingInjectIndexes(cls);
      if (missing.length) problems.push(`${mod.name} > ${cls.name}: parâmetro(s) ${missing.join(', ')} do construtor sem @Inject`);
    };
    controllers.forEach(checkClass);
    for (const provider of providers) {
      if (typeof provider === 'function') checkClass(provider);
      else if (provider.useClass) checkClass(provider.useClass);
      else if (provider.useFactory && provider.useFactory.length > (provider.inject?.length ?? 0)) {
        problems.push(`${mod.name} > ${nameOf(provider.provide)}: useFactory recebe ${provider.useFactory.length} parâmetro(s) e inject lista ${provider.inject?.length ?? 0}`);
      }
    }
    for (const imported of imports) if (typeof imported === 'function') visit(imported as Type);
  };
  visit(root);
  return problems;
}

describe('injeção de dependência explícita (ADR-002)', () => {
  it('todo controller e provider do AppModule declara @Inject em cada parâmetro do construtor', () => {
    expect(findImplicitInjections(AppModule)).toEqual([]);
  });

  describe('o verificador', () => {
    @Injectable() class Dep {}
    const TOKEN = Symbol('TOKEN');

    it('acusa parâmetro sem @Inject em provider e em controller, inclusive em módulo importado', () => {
      @Injectable() class SemInject { constructor(readonly dep: Dep) {} }
      @Controller() class ControllerSemInject { constructor(@Inject(Dep) readonly a: Dep, readonly b: Dep) {} }
      @Module({ controllers: [ControllerSemInject], providers: [Dep, SemInject] }) class Filho {}
      @Module({ imports: [Filho] }) class Raiz {}

      expect(findImplicitInjections(Raiz)).toEqual([
        'Filho > ControllerSemInject: parâmetro(s) 1 do construtor sem @Inject',
        'Filho > SemInject: parâmetro(s) 0 do construtor sem @Inject',
      ]);
    });

    it('acusa useClass sem @Inject e useFactory com inject incompleto', () => {
      @Injectable() class Impl { constructor(readonly dep: Dep) {} }
      @Module({ providers: [Dep, { provide: TOKEN, useClass: Impl }, { provide: 'FACTORY', useFactory: (d: Dep) => d, inject: [] }] })
      class Raiz {}

      expect(findImplicitInjections(Raiz)).toEqual([
        'Raiz > Impl: parâmetro(s) 0 do construtor sem @Inject',
        'Raiz > FACTORY: useFactory recebe 1 parâmetro(s) e inject lista 0',
      ]);
    });

    it('aceita @Inject explícito, construtor vazio, parâmetro com valor padrão e useValue', () => {
      @Injectable() class ComInject { constructor(@Inject(Dep) readonly dep: Dep, @Inject(TOKEN) readonly t: unknown) {} }
      @Injectable() class ComPadrao { constructor(readonly root = '/tmp') {} }
      @Module({ providers: [Dep, ComInject, ComPadrao, { provide: TOKEN, useValue: 1 }, { provide: 'F', useFactory: (d: Dep) => d, inject: [Dep] }] })
      class Raiz {}

      expect(findImplicitInjections(Raiz)).toEqual([]);
    });
  });
});
