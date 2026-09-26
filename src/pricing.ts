export type PricingInput = {
  mode: "chips" | "messages";
  chips: number;
  messages: number;
  messagesPerChip: number;
  chipsPerBm: number;
  bmCost: number;
  deliveryRate: number;
  chipCost: number;
  activationCost: number;
  rechargeCost: number;
  otherPerChip: number;
  campaignCost: number;
  salesTax: number;
  margin: number;
};
export const defaultPricing: PricingInput = {
  mode: "messages",
  chips: 10,
  messages: 1000,
  messagesPerChip: 250,
  chipsPerBm: 1,
  bmCost: 0,
  deliveryRate: 100,
  chipCost: 0,
  activationCost: 0,
  rechargeCost: 0,
  otherPerChip: 0,
  campaignCost: 0,
  salesTax: 0,
  margin: 30,
};
export function calculatePricing(p: PricingInput, overheadCosts = 0) {
  if (!p || !["chips", "messages"].includes(p.mode))
    throw new Error("Selecione a forma de cálculo.");
  const integer = (x: number, min: number, max: number) =>
    Number.isSafeInteger(x) && x >= min && x <= max;
  if (
    !integer(p.chips, 1, 1000000) ||
    !integer(p.messages, 1, 1000000000) ||
    !integer(p.messagesPerChip, 1, 1000000) ||
    !integer(p.chipsPerBm, 1, 1000)
  )
    throw new Error("Informe quantidades inteiras maiores que zero.");
  if (
    !Number.isFinite(p.deliveryRate) ||
    p.deliveryRate <= 0 ||
    p.deliveryRate > 100
  )
    throw new Error(
      "A taxa de entrega deve ser maior que 0% e no máximo 100%.",
    );
  if (
    [
      p.bmCost,
      p.chipCost,
      p.activationCost,
      p.rechargeCost,
      p.otherPerChip,
      p.campaignCost,
    ].some((x) => !integer(x, 0, 100000000000))
  )
    throw new Error("Informe custos válidos, em reais, sem valores negativos.");
  if (
    [p.salesTax, p.margin].some(
      (x) => !Number.isFinite(x) || x < 0 || x >= 100,
    ) ||
    p.salesTax + p.margin >= 100
  )
    throw new Error("A soma da margem com as taxas deve ser menor que 100%.");
  const usablePerChip = Math.floor((p.messagesPerChip * p.deliveryRate) / 100);
  if (usablePerChip < 1)
    throw new Error(
      "A capacidade efetiva precisa ser de pelo menos uma mensagem por BM.",
    );
  const bms =
    p.mode === "chips"
      ? Math.floor(p.chips / p.chipsPerBm)
      : Math.ceil(p.messages / usablePerChip);
  if (bms < 1) throw new Error("Não há chips suficientes para ativar uma BM.");
  const chips = bms * p.chipsPerBm;
  const capacity = bms * usablePerChip;
  const messages = p.mode === "chips" ? capacity : p.messages;
  const perChip =
    p.chipCost + p.activationCost + p.rechargeCost + p.otherPerChip;
  if (!integer(overheadCosts, 0, 100000000000000))
    throw new Error("Os custos fixos integrados são inválidos.");
  const cost =
    chips * perChip + bms * p.bmCost + p.campaignCost + overheadCosts;
  if (!Number.isSafeInteger(cost) || cost > 100000000000000)
    throw new Error("O custo total excede o limite permitido.");
  const price = Math.ceil(cost / (1 - (p.margin + p.salesTax) / 100));
  const tax = Math.round((price * p.salesTax) / 100);
  return {
    bms,
    chips,
    capacity,
    messages,
    usablePerChip,
    perChip,
    cost,
    price,
    tax,
    profit: price - tax - cost,
    unitCost: cost / messages,
    unitPrice: price / messages,
    chipPrice: price / chips,
    spare: capacity - messages,
  };
}
