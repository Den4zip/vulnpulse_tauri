pub(crate) struct DemoEntry {
    pub id: String,
    pub title: String,
}

pub(crate) struct DemoLimit(u32);

impl DemoLimit {
    pub fn new(value: u32) -> Option<Self> {
        (1..=20).contains(&value).then_some(Self(value))
    }

    pub fn get(&self) -> u32 {
        self.0
    }
}

#[cfg(test)]
mod tests {
    use super::DemoLimit;

    #[test]
    fn demo_limit_checks_both_bounds() {
        for limit in [1, 20] {
            assert_eq!(DemoLimit::new(limit).map(|value| value.get()), Some(limit));
        }
        for limit in [0, 21, u32::MAX] {
            assert!(DemoLimit::new(limit).is_none());
        }
    }
}
