# Xeroww Formula Reference

All portfolio results are calculated from immutable observed snapshots. Each API metric includes a formula identifier, formula version, observation window, observation count, data quality state, and limitations.

## Returns

- Absolute return: final portfolio value divided by initial portfolio value, minus one.
- Time-weighted return: product of one plus each observed subperiod return, minus one.
- Money-weighted return: currently equals absolute return because the portfolio model has no intermediate external cash flows. The API reports this limitation explicitly.
- Benchmark return: final NIFTY 50 close divided by initial NIFTY 50 close, minus one.
- Excess return: portfolio absolute return minus benchmark return.

## Risk and path

- Annualized volatility: sample standard deviation of observed snapshot returns multiplied by the square root of 252.
- Drawdown: current portfolio value divided by the highest prior portfolio value, minus one.
- Maximum drawdown: the most negative observed drawdown.
- Recovery period: observed snapshot periods from the maximum drawdown trough until the prior peak is reached again.
- Beta: covariance of portfolio and benchmark returns divided by benchmark return variance.
- Component risk contribution: position weight multiplied by its marginal covariance contribution, scaled to annualized volatility.
- Concentration HHI: sum of squared holding weights.

## Attribution and behaviour

- Holding contribution uses the change in observed holding market value between two snapshots, adjusted for the model's recorded holding state.
- Sector contribution is the sum of holding contributions within the stored sector classification.
- Replay process score is versioned as `process-v1`. It scores plan quality, risk discipline, invalidation discipline, amendment discipline, entry adherence, exit adherence, and reflection completion.
- Replay outcome values such as realized R, favourable excursion, and adverse excursion never change the process score.

## Data quality

An `INSUFFICIENT` result is not treated as zero. Partial price coverage, missing benchmark history, insufficient aligned return observations, and missing entry activation are surfaced as explicit quality states or limitations.
