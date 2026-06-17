import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { bytes: Uint8Array
                                                                             }];
}

export type ImpureCircuits<PS> = {
  balanceOf(context: __compactRuntime.CircuitContext<PS>,
            holder_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, bigint>;
  mint(context: __compactRuntime.CircuitContext<PS>,
       to_0: { bytes: Uint8Array },
       amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  burn(context: __compactRuntime.CircuitContext<PS>,
       holder_0: { bytes: Uint8Array },
       amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  transfer(context: __compactRuntime.CircuitContext<PS>,
           to_0: { bytes: Uint8Array },
           amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  mintShieldedToken(context: __compactRuntime.CircuitContext<PS>,
                    to_0: { bytes: Uint8Array },
                    amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  burnShieldedToken(context: __compactRuntime.CircuitContext<PS>,
                    amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  balanceOf(context: __compactRuntime.CircuitContext<PS>,
            holder_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, bigint>;
  mint(context: __compactRuntime.CircuitContext<PS>,
       to_0: { bytes: Uint8Array },
       amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  burn(context: __compactRuntime.CircuitContext<PS>,
       holder_0: { bytes: Uint8Array },
       amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  transfer(context: __compactRuntime.CircuitContext<PS>,
           to_0: { bytes: Uint8Array },
           amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  mintShieldedToken(context: __compactRuntime.CircuitContext<PS>,
                    to_0: { bytes: Uint8Array },
                    amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  burnShieldedToken(context: __compactRuntime.CircuitContext<PS>,
                    amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  deriveAdminPublicKey(sk_0: { bytes: Uint8Array }): { bytes: Uint8Array };
}

export type Circuits<PS> = {
  balanceOf(context: __compactRuntime.CircuitContext<PS>,
            holder_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, bigint>;
  mint(context: __compactRuntime.CircuitContext<PS>,
       to_0: { bytes: Uint8Array },
       amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  burn(context: __compactRuntime.CircuitContext<PS>,
       holder_0: { bytes: Uint8Array },
       amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  transfer(context: __compactRuntime.CircuitContext<PS>,
           to_0: { bytes: Uint8Array },
           amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  deriveAdminPublicKey(context: __compactRuntime.CircuitContext<PS>,
                       sk_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, { bytes: Uint8Array
                                                                                         }>;
  mintShieldedToken(context: __compactRuntime.CircuitContext<PS>,
                    to_0: { bytes: Uint8Array },
                    amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  burnShieldedToken(context: __compactRuntime.CircuitContext<PS>,
                    amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly totalSupply: bigint;
  readonly contractAdmin: { bytes: Uint8Array };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
