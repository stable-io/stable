use std::ops::{Add, Div, Mul, Sub};

pub enum Int<T> {
    Ok(T),
    Overflow,
    DivisionByZero,
}

macro_rules! impl_int_op {
    ($self:ty, $other:ty, $out:ty) => {
        impl Mul<$other> for Int<$self> {
            type Output = Int<$out>;

            fn mul(self, other: $other) -> Self::Output {
                match self {
                    Int::Ok(value) => {
                        match (<$out>::from(value)).checked_mul(<$out>::from(other)) {
                            Some(result) => Int::Ok(result),
                            None => Int::Overflow,
                        }
                    }
                    Int::Overflow => Int::Overflow,
                    Int::DivisionByZero => Int::DivisionByZero,
                }
            }
        }

        impl Mul<Int<$other>> for Int<$self> {
            type Output = Int<$out>;

            fn mul(self, other: Int<$other>) -> Self::Output {
                match (self, other) {
                    (Int::Ok(value), Int::Ok(other)) => {
                        match (<$out>::from(value)).checked_mul(<$out>::from(other)) {
                            Some(result) => Int::Ok(result),
                            None => Int::Overflow,
                        }
                    }
                    (Int::Ok(_), Int::Overflow) => Int::Overflow,
                    (Int::Ok(_), Int::DivisionByZero) => Int::DivisionByZero,
                    (Int::Overflow, _) => Int::Overflow,
                    (Int::DivisionByZero, _) => Int::DivisionByZero,
                }
            }
        }

        impl Add<$other> for Int<$self> {
            type Output = Int<$out>;

            fn add(self, other: $other) -> Self::Output {
                match self {
                    Int::Ok(value) => {
                        match (<$out>::from(value)).checked_add(<$out>::from(other)) {
                            Some(result) => Int::Ok(result),
                            None => Int::Overflow,
                        }
                    }
                    Int::Overflow => Int::Overflow,
                    Int::DivisionByZero => Int::DivisionByZero,
                }
            }
        }

        impl Add<Int<$other>> for Int<$self> {
            type Output = Int<$out>;

            fn add(self, other: Int<$other>) -> Self::Output {
                match (self, other) {
                    (Int::Ok(value), Int::Ok(other)) => {
                        match (<$out>::from(value)).checked_add(<$out>::from(other)) {
                            Some(result) => Int::Ok(result),
                            None => Int::Overflow,
                        }
                    }
                    (Int::Ok(_), Int::Overflow) => Int::Overflow,
                    (Int::Ok(_), Int::DivisionByZero) => Int::DivisionByZero,
                    (Int::Overflow, _) => Int::Overflow,
                    (Int::DivisionByZero, _) => Int::DivisionByZero,
                }
            }
        }

        impl Sub<$other> for Int<$self> {
            type Output = Int<$out>;

            fn sub(self, other: $other) -> Self::Output {
                match self {
                    Int::Ok(value) => {
                        match (<$out>::from(value)).checked_sub(<$out>::from(other)) {
                            Some(result) => Int::Ok(result),
                            None => Int::Overflow,
                        }
                    }
                    Int::Overflow => Int::Overflow,
                    Int::DivisionByZero => Int::DivisionByZero,
                }
            }
        }

        impl Sub<Int<$other>> for Int<$self> {
            type Output = Int<$out>;

            fn sub(self, other: Int<$other>) -> Self::Output {
                match (self, other) {
                    (Int::Ok(value), Int::Ok(other)) => {
                        match (<$out>::from(value)).checked_sub(<$out>::from(other)) {
                            Some(result) => Int::Ok(result),
                            None => Int::Overflow,
                        }
                    }
                    (Int::Ok(_), Int::Overflow) => Int::Overflow,
                    (Int::Ok(_), Int::DivisionByZero) => Int::DivisionByZero,
                    (Int::Overflow, _) => Int::Overflow,
                    (Int::DivisionByZero, _) => Int::DivisionByZero,
                }
            }
        }

        impl Div<$other> for Int<$self> {
            type Output = Int<$out>;

            fn div(self, other: $other) -> Self::Output {
                match self {
                    Int::Ok(value) => {
                        match (<$out>::from(value)).checked_div(<$out>::from(other)) {
                            Some(result) => Int::Ok(result),
                            None => Int::DivisionByZero,
                        }
                    }
                    Int::Overflow => Int::Overflow,
                    Int::DivisionByZero => Int::DivisionByZero,
                }
            }
        }
    };
}

impl_int_op!(u64, u64, u64);
impl_int_op!(u64, u32, u64);
impl_int_op!(u64, u128, u128);
impl_int_op!(u32, u32, u32);
impl_int_op!(u32, u8, u32);
impl_int_op!(u64, u8, u64);
impl_int_op!(u32, u64, u64);

macro_rules! impl_int {
    ($self:ty, $up:ty) => {
        impl Int<$self> {
            pub fn mul_div(self, numerator: $self, denominator: $self) -> Self {
                let Self::Ok(value) = self else {
                    return self;
                };

                if denominator == 0 {
                    return Int::DivisionByZero;
                }

                match <$self>::try_from(
                    <$up>::from(value) * <$up>::from(numerator) / <$up>::from(denominator),
                ) {
                    Ok(result) => Int::Ok(result),
                    Err(_) => Int::Overflow,
                }
            }

            pub fn at_least(self, other: $self) -> Self {
                match self {
                    Int::Ok(value) => Int::Ok(value.max(other)),
                    err => err,
                }
            }
        }
    };
}

impl_int!(u64, u128);
impl_int!(u32, u64);
