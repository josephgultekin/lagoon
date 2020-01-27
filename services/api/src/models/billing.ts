import moment from 'moment';
import R from 'ramda';
import { Group, BillingGroup } from './group';
import { getKeycloakAdminClient } from '../clients/keycloak-admin';
import { getSqlClient, USE_SINGLETON } from '../clients/sqlClient';
import { query } from '../util/db';
import Sql from '../resources/billing/sql';
import { GroupInput } from "./group";

export interface BillingModifierBase {
  id?: number;
  groupId?: string;
  startDate?: string;
  endDate?: string;
  discountFixed?: number;
  discountPercentage?: number;
  extraFixed?: number;
  extraPercentage?: number;
  customerComments?: string;
  adminComments?: string;
  weight?: number;
}
export interface BillingModifier extends BillingModifierBase{
  group?: Group;
}

/**
 * Create/Add Billing Modifier
 *
 * @param {BillingModifier} modifier The modifier values
 *
 * @return {BillingModifier} The created modifier
 */
export const addBillingModifier = async (modifier: BillingModifier) => {
  const sqlClient = getSqlClient(USE_SINGLETON);
  const { info: { insertId } } = await query(sqlClient, Sql.addBillingModifier(modifier));
  const rows = await query(
    sqlClient,
    Sql.selectBillingModifier(parseInt(insertId, 10))
  );
  return R.prop(0, rows) as BillingModifier;
};

/**
 * Get Billing Modifier By ID
 *
 * @param {Int} id The modifier values
 *
 * @return {BillingModifier} The modifier
 */
export const getBillingModifier = async (
  id: number,
) => {
  const sqlClient = getSqlClient(USE_SINGLETON);
  const keycloakAdminClient = await getKeycloakAdminClient();
  const GroupModel = Group({ keycloakAdminClient });

  const rows = await query(sqlClient, Sql.selectBillingModifier(id));
  if (rows.length === 0) {
    throw new Error('Billing modifier does not exist.');
  }

  const {groupId, ...rest} = R.prop(0, rows) as BillingModifier;
  const group: BillingGroup = await GroupModel.loadGroupByIdOrName({id: groupId});
  return {...rest, group};
};

/**
 * Get All Billing Modifiers for a Billing Group
 *
 * @param {BillingModifierInput} groupNameOrId The Group Name or ID
 *
 * @return {[BillingModifier]} The created modifier
 */
export const getBillingModifiers = async (
  groupNameOrId: GroupInput,
  month: string
) => {
  const sqlClient = getSqlClient(USE_SINGLETON);
  const keycloakAdminClient = await getKeycloakAdminClient();
  const GroupModel = Group({ keycloakAdminClient });
  const group = await GroupModel.loadGroupByIdOrName(groupNameOrId);

  const YEAR_MONTH = 'YYYY-MM-DD HH:mm:ss';
  const monthStart = month
    ? moment(new Date(month).toISOString()).startOf('month').format(YEAR_MONTH).toString()
    : undefined;
  const monthEnd = month
    ? moment(new Date(month).toISOString()).endOf('month').format(YEAR_MONTH).toString()
    : undefined;

  const sql = Sql.getAllBillingModifierByBillingGroup(group.id, monthStart, monthEnd );
  console.log(sql);
  const result = (await query(sqlClient, sql));
  return result.map(({weight, discountFixed, discountPercentage, extraFixed, extraPercentage, ...rest}) => 
    ({ 
      ...rest, 
      group, 
      weight: parseInt(weight, 10),
      discountFixed: parseFloat(discountFixed), 
      discountPercentage: parseFloat(discountPercentage), 
      extraFixed: parseFloat(extraFixed), 
      extraPercentage: parseFloat(extraPercentage) }));
};

/**
 * Update Billing Modifier
 *
 * @param {BillingModifier} modifier The modifier values
 *
 * @return {BillingModifier} The created modifier
 */
export const updateBillingModifier = async (modifier: BillingModifier ) => {
  const sqlClient = getSqlClient(USE_SINGLETON);
  await query(sqlClient, Sql.updateBillingModifier(modifier.id, modifier));
  return getBillingModifier(modifier.id);
};

/**
 * Delete Billing Modifier
 *
 * @param {number} id The modifier id
 *
 * @return {BillingModifier} The created modifier
 */
export const deleteBillingModifier = async (id: number) => {
  const sqlClient = getSqlClient(USE_SINGLETON);
  await query(sqlClient, Sql.deleteBillingModifier(id));
  return 'success';
}

/**
 * Delete All Billing Modifiers for a Billing Group
 *
 * @param {GroupInput} groupNameOrId The Billing Group Name or ID
 *
 * @return {Boolean} Success
 */
export const deleteAllBillingGroupModifiers = async (
  groupNameOrId: GroupInput
) => {
  const keycloakAdminClient = await getKeycloakAdminClient();
  const GroupModel = Group({ keycloakAdminClient });
  const group = await GroupModel.loadGroupByIdOrName(groupNameOrId);

  const sqlClient = getSqlClient(USE_SINGLETON);
  const sql = Sql.deleteAllBillingModifiersByBillingGroup(group.id);
  await query(sqlClient, sql);
  return 'success';
};

export default {
  addBillingModifier,
  updateBillingModifier,
  deleteBillingModifier,
  deleteAllBillingGroupModifiers,
  getBillingModifiers
};
