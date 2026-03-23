/**
 * Extension service-worker-safe poseidon hash functions using BarretenbergSync.
 *
 * Sync copy of @aztec/foundation/src/crypto/poseidon/index.ts which uses the
 * async Barretenberg that spawns Web Workers — incompatible with extension
 * service workers. This module provides the same functions using
 * BarretenbergSync (as v4.0 did).
 *
 * Vite alias in vite.config.ts redirects "@aztec/foundation/crypto/poseidon"
 * to this file for the service worker build.
 */
import { BarretenbergSync } from '@aztec/bb.js';

import { Fr } from '@aztec/foundation/curves/bn254';
import { type Fieldable, serializeToFields } from '@aztec/foundation/serialize';

/**
 * Create a poseidon hash (field) from an array of input fields.
 * @param input - The input fields to hash.
 * @returns The poseidon hash.
 */
export async function poseidon2Hash(input: Fieldable[]): Promise<Fr> {
  const inputFields = serializeToFields(input);
  await BarretenbergSync.initSingleton();
  const api = BarretenbergSync.getSingleton();
  const response = api.poseidon2Hash({
    inputs: inputFields.map(i => i.toBuffer()),
  });
  return Fr.fromBuffer(Buffer.from(response.hash));
}

/**
 * Create a poseidon hash (field) from an array of input fields and a domain separator.
 * @param input - The input fields to hash.
 * @param separator - The domain separator.
 * @returns The poseidon hash.
 */
export async function poseidon2HashWithSeparator(input: Fieldable[], separator: number): Promise<Fr> {
  const inputFields = serializeToFields(input);
  inputFields.unshift(new Fr(separator));
  await BarretenbergSync.initSingleton();
  const api = BarretenbergSync.getSingleton();
  const response = api.poseidon2Hash({
    inputs: inputFields.map(i => i.toBuffer()),
  });
  return Fr.fromBuffer(Buffer.from(response.hash));
}

/**
 * Runs a Poseidon2 permutation.
 * @param input the input state. Expected to be of size 4.
 * @returns the output state, size 4.
 */
export async function poseidon2Permutation(input: Fieldable[]): Promise<Fr[]> {
  const inputFields = serializeToFields(input);
  // We'd like this assertion but it's not possible to use it in the browser.
  // assert(input.length === 4, 'Input state must be of size 4');
  await BarretenbergSync.initSingleton();
  const api = BarretenbergSync.getSingleton();
  const response = api.poseidon2Permutation({
    inputs: inputFields.map(i => i.toBuffer()),
  });
  // We'd like this assertion but it's not possible to use it in the browser.
  // assert(response.outputs.length === 4, 'Output state must be of size 4');
  return response.outputs.map(o => Fr.fromBuffer(Buffer.from(o)));
}

export async function poseidon2HashBytes(input: Buffer): Promise<Fr> {
  const inputFields = [];
  for (let i = 0; i < input.length; i += 31) {
    const fieldBytes = Buffer.alloc(32, 0);
    input.slice(i, i + 31).copy(fieldBytes);

    // Noir builds the bytes as little-endian, so we need to reverse them.
    fieldBytes.reverse();
    inputFields.push(Fr.fromBuffer(fieldBytes));
  }

  await BarretenbergSync.initSingleton();
  const api = BarretenbergSync.getSingleton();
  const response = api.poseidon2Hash({
    inputs: inputFields.map(i => i.toBuffer()),
  });

  return Fr.fromBuffer(Buffer.from(response.hash));
}
